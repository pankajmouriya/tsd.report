"""Small, dependency-free CI guards and packaging; not the deployment verifier."""
import hashlib
import json
import os
import re
import stat
import sys
import tarfile
import urllib.request
from pathlib import Path


CONTRACTS = {
    'candidate': ['candidate:validate', 'test:e2e:candidate', 'verify:build'],
    'preview': ['verify:artifact', 'verify:build', 'smoke:deployment'],
    'production-build': ['verify:deployment-config', 'verify:build', 'release:manifest', 'test:e2e:production'],
    'staging': ['verify:artifact', 'verify:build', 'smoke:deployment', 'test:e2e:production',
                'release:inventory', 'release:rehearse-rollback', 'release:evidence'],
    'release': ['verify:artifact', 'verify:build', 'smoke:deployment', 'test:e2e:production',
                'release:authorize', 'release:inventory', 'release:recover', 'release:evidence'],
    'daily': ['candidate:generate', 'candidate:validate', 'candidate:open-pr'],
}


def require_enabled(value):
    if value != 'true':
        raise ValueError('Workflow is disabled. Configure its TSD_*_ENABLED variable only after the documented prerequisites pass.')


def hex_value(value, length):
    if not re.fullmatch(r'[0-9a-f]{' + str(length) + r'}', value):
        raise ValueError(f'Expected exactly {length} lowercase hexadecimal characters')
    return value


def require_contract(root, profile):
    package = json.loads((root / 'package.json').read_text())
    missing = [name for name in CONTRACTS[profile] if not package.get('scripts', {}).get(name)]
    if profile in ['preview', 'staging', 'release']:
        if not (root / 'public/_headers').is_file(): missing.append('public/_headers')
        version = package.get('devDependencies', {}).get('wrangler', '')
        if not re.fullmatch(r'\d+\.\d+\.\d+', version): missing.append('exact pinned devDependency wrangler')
        else:
            lock = json.loads((root / 'package-lock.json').read_text())
            if lock.get('packages', {}).get('node_modules/wrangler', {}).get('version') != version:
                missing.append('matching locked Wrangler version')
    if missing:
        raise ValueError(f'{profile} is blocked; implement and verify: ' + ', '.join(missing))


def preview_identity(event, pr, repository):
    run = event['workflow_run']
    if run['event'] != 'pull_request' or run['conclusion'] != 'success':
        raise ValueError('Preview requires a successful pull_request validation run')
    pulls = run.get('pull_requests', [])
    if len(pulls) != 1 or run.get('head_repository', {}).get('full_name') != repository:
        raise ValueError('Preview requires one same-repository pull request')
    sha = hex_value(run['head_sha'], 40)
    number = pulls[0]['number']
    if not isinstance(number, int) or number <= 0:
        raise ValueError('Invalid PR number')
    if pr['state'] != 'open' or pr['head']['sha'] != sha or pr['head']['repo']['full_name'] != repository:
        raise ValueError('Closed, stale, or fork pull request cannot deploy')
    return number, sha


def pack(dist, output, metadata):
    if not dist.is_dir() or not (dist / 'index.html').is_file():
        raise ValueError('Missing generated static site')
    files = {}
    for path in sorted(dist.rglob('*')):
        mode = path.lstat().st_mode
        name = path.relative_to(dist).as_posix()
        parts = path.relative_to(dist).parts
        if stat.S_ISLNK(mode) or not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
            raise ValueError(f'Unsupported archive entry: {name}')
        if any(p.lower() in {'_worker.js', '_routes.json', 'functions', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc'} for p in parts):
            raise ValueError(f'Runtime/configuration output is forbidden: {name}')
        if any(p.startswith('.') for p in parts) and name not in {'.well-known', '.well-known/security.txt'}:
            raise ValueError(f'Unexpected hidden output: {name}')
        if stat.S_ISREG(mode):
            files[name] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
    if metadata.get('content_mode') == 'production' and '.well-known/security.txt' not in files:
        raise ValueError('Production artifact requires .well-known/security.txt')
    output.mkdir(parents=True, exist_ok=False)
    archive_path = output / 'site.tar'
    with tarfile.open(archive_path, 'w', format=tarfile.USTAR_FORMAT) as archive:
        for name in files:
            path = dist / name
            info = tarfile.TarInfo(name)
            info.size = path.stat().st_size
            info.mode = 0o644
            with path.open('rb') as body: archive.addfile(info, body)
    digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    manifest = {**metadata, 'schema_version': 1, 'archive_sha256': digest,
                'files': files, 'file_count': len(files), 'bytes': sum(f['bytes'] for f in files.values())}
    (output / 'release-manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    (output / 'site.tar.sha256').write_text(f'{digest}  site.tar\n')
    return digest


def emit(name, value):
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write(f'{name}={value}\n')


def main():
    command = sys.argv[1]
    root = Path.cwd()
    if command == 'require':
        require_contract(root, sys.argv[2])
    elif command == 'enabled':
        require_enabled(os.environ.get(sys.argv[2], ''))
    elif command == 'hex':
        hex_value(os.environ.get(sys.argv[2], ''), int(sys.argv[3]))
    elif command == 'preview':
        event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        pulls = event['workflow_run'].get('pull_requests', [])
        if len(pulls) != 1: raise ValueError('Expected exactly one associated PR')
        number = pulls[0]['number']
        if not isinstance(number, int) or number <= 0: raise ValueError('Invalid PR number')
        repository = os.environ['GITHUB_REPOSITORY']
        url = f'https://api.github.com/repos/{repository}/pulls/{number}'
        request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
                                         'Accept': 'application/vnd.github+json', 'User-Agent': 'tsd-release-controls'})
        with urllib.request.urlopen(request, timeout=20) as response:
            pr = json.loads(response.read(2_000_000))
        number, sha = preview_identity(event, pr, repository)
        emit('number', number)
        emit('sha', sha)
    elif command == 'mode':
        mode = 'candidate' if (root / '.github/candidate-preview.json').exists() else 'fixture'
        if mode == 'candidate': require_contract(root, 'candidate')
        emit('mode', mode)
    elif command == 'pack':
        mode = os.environ['CONTENT_MODE']
        if mode not in {'fixture', 'candidate', 'production'}: raise ValueError('Invalid mode')
        metadata = {'content_mode': mode, 'source_sha': hex_value(os.environ['SOURCE_SHA'], 40),
                    'build_sha': hex_value(os.environ['BUILD_SHA'], 40), 'run_id': os.environ['GITHUB_RUN_ID'],
                    'run_attempt': os.environ['GITHUB_RUN_ATTEMPT'],
                    'lockfile_sha256': hashlib.sha256((root / 'package-lock.json').read_bytes()).hexdigest()}
        digest = pack(root / 'dist', Path(sys.argv[2]), metadata)
        emit('digest', digest)
    else:
        raise ValueError('Unknown release control command')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        print(f'Release control failed: {error}', file=sys.stderr)
        sys.exit(1)
