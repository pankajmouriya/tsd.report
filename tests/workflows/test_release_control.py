import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('release_control', Path(__file__).resolve().parents[2] / '.github/scripts/release_control.py')
control = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(control)


class ReleaseControlTests(unittest.TestCase):
    def test_missing_contract_fails_with_actionable_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'package.json').write_text('{"scripts":{}}')
            with self.assertRaisesRegex(ValueError, 'verify:artifact'):
                control.require_contract(root, 'preview')

    def test_feature_flag_is_explicit_opt_in(self):
        for value in ['', 'false', 'TRUE', '1']:
            with self.assertRaises(ValueError):
                control.require_enabled(value)
        control.require_enabled('true')

    def test_digest_and_sha_reject_shell_text(self):
        control.hex_value('a' * 40, 40)
        control.hex_value('b' * 64, 64)
        for value in ['main', 'a' * 39, '$(id)', 'a' * 40 + '\n']:
            with self.assertRaises(ValueError):
                control.hex_value(value, 40)

    def test_preview_event_rejects_fork_closed_and_stale_pr(self):
        sha = 'a' * 40
        event = {'workflow_run': {'event': 'pull_request', 'conclusion': 'success', 'head_sha': sha,
                 'head_repository': {'full_name': 'owner/repo'}, 'pull_requests': [{'number': 12}]}}
        pr = {'state': 'open', 'head': {'sha': sha, 'repo': {'full_name': 'owner/repo'}}}
        self.assertEqual(control.preview_identity(event, pr, 'owner/repo'), (12, sha))
        pr['head']['sha'] = 'b' * 40
        with self.assertRaises(ValueError): control.preview_identity(event, pr, 'owner/repo')
        pr['head']['sha'] = sha
        pr['state'] = 'closed'
        with self.assertRaises(ValueError): control.preview_identity(event, pr, 'owner/repo')
        pr['state'] = 'open'
        pr['head']['repo']['full_name'] = 'fork/repo'
        with self.assertRaises(ValueError): control.preview_identity(event, pr, 'owner/repo')

    def test_pack_preserves_hidden_contact_and_binds_actual_commit(self):
        import tarfile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dist = root / 'dist'
            (dist / '.well-known').mkdir(parents=True)
            (dist / 'index.html').write_text('Fixture preview')
            (dist / '.well-known/security.txt').write_text('Synthetic packing test only')
            meta = {'content_mode': 'fixture', 'source_sha': 'a' * 40, 'build_sha': 'b' * 40, 'run_id': '10'}
            control.pack(dist, root / 'artifact', meta)
            manifest = json.loads((root / 'artifact/release-manifest.json').read_text())
            self.assertEqual(manifest['build_sha'], 'b' * 40)
            self.assertIn('.well-known/security.txt', manifest['files'])
            with tarfile.open(root / 'artifact/site.tar') as archive:
                self.assertEqual(archive.extractfile('.well-known/security.txt').read(), b'Synthetic packing test only')
            control.pack(dist, root / 'again', meta)
            self.assertEqual((root / 'artifact/site.tar').read_bytes(), (root / 'again/site.tar').read_bytes())

    def test_pack_rejects_symlinks_and_runtime_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dist = root / 'dist'
            dist.mkdir()
            (dist / 'index.html').write_text('fixture')
            (dist / 'link').symlink_to('/etc/passwd')
            with self.assertRaises(ValueError): control.pack(dist, root / 'out', {})
            (dist / 'link').unlink()
            (dist / '_worker.js').write_text('export default {}')
            with self.assertRaises(ValueError): control.pack(dist, root / 'out', {})


if __name__ == '__main__':
    unittest.main()
