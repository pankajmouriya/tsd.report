# Cloudflare Account and `tsd.report` DNS Setup

**Registrar:** GoDaddy
**Authoritative DNS target:** Cloudflare
**Domain:** `tsd.report`

This runbook moves authoritative DNS from GoDaddy to Cloudflare without transferring the domain registration. Complete the phases in order.

## Current public DNS inventory

Recorded before migration:

| Type | Name | Value |
| --- | --- | --- |
| NS | `@` | `ns63.domaincontrol.com` |
| NS | `@` | `ns64.domaincontrol.com` |
| A | `@` | `15.197.148.33` |
| A | `@` | `3.33.130.190` |
| CNAME | `www` | `tsd.report` |

No public AAAA, MX, TXT, CAA, or DS records were found during the initial query. Still compare the complete GoDaddy DNS record list because an automatic scan or targeted public query may not discover every record or subdomain.

## Phase 1: Create and secure the Cloudflare account

- [ ] Open [Cloudflare sign-up](https://dash.cloudflare.com/sign-up).
- [ ] Enter your email address and create a strong password.
- [ ] Verify your email through the message Cloudflare sends.
- [ ] Sign in to the Cloudflare dashboard.
- [ ] Open the profile menu, then select **My Profile** → **Authentication**.
- [ ] Enable two-factor authentication.
- [ ] Store the recovery codes securely outside the repository.

## Phase 2: Add `tsd.report` to Cloudflare

- [ ] From the Cloudflare dashboard, select **Add** → **Connect a domain**.

Some dashboard versions show **Domains** → **Onboard a domain**.

- [ ] Enter:

  ```text
  tsd.report
  ```

- [ ] Select **Quick scan for DNS records**.
- [ ] Select **Continue**.
- [ ] Choose the **Free** plan.
- [ ] Select **Continue** to reach the DNS record review screen.

Cloudflare may find these existing records:

| Type | Name | Value | Proxy status during migration |
| --- | --- | --- | --- |
| A | `@` | `15.197.148.33` | DNS only |
| A | `@` | `3.33.130.190` | DNS only |
| CNAME | `www` | `tsd.report` | DNS only |

These records currently point to GoDaddy's parked-domain service. Keep them temporarily so the domain continues behaving as it does now.

### Set imported web records to DNS only

For each imported A or CNAME record:

- [ ] Select **Edit**.
- [ ] Change **Proxy status** to **DNS only**.
- [ ] Confirm the cloud icon is gray.
- [ ] Keep **TTL** set to **Auto**.
- [ ] Select **Save**.

Do not add a Cloudflare Pages record yet. That happens after the Pages project has its first successful deployment.

## Phase 3: Compare Cloudflare with GoDaddy

Before changing nameservers:

- [ ] Open the [GoDaddy Domain Portfolio](https://dcc.godaddy.com/portfolio).
- [ ] Select `tsd.report`.
- [ ] Select **DNS**.
- [ ] Open **DNS Records**.
- [ ] Capture or export the complete GoDaddy DNS record list.
- [ ] Compare every GoDaddy record with the Cloudflare DNS screen.

Copy any additional records into Cloudflare, especially:

- MX records.
- TXT records.
- Email verification records.
- SPF, DKIM, or DMARC records.
- Other A or CNAME records.
- SRV records.
- CAA records.
- Custom subdomains.

Do not manually copy:

- GoDaddy's apex NS records.
- GoDaddy's SOA record.

Do not continue until every required non-NS/SOA record exists in Cloudflare with the correct name, value, priority, and TTL.

Reference: [Cloudflare full-zone setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/).

## Phase 4: Check DNSSEC before changing nameservers

In GoDaddy:

- [ ] While viewing `tsd.report`, select **DNS**.
- [ ] Open **DS Records** or **DNSSEC**.
- [ ] Confirm there are no DS records.

If a DS record exists:

- [ ] Delete the DS record.
- [ ] Confirm the deletion.
- [ ] Wait until GoDaddy shows no DS records before continuing.

Changing nameservers while an old DS record remains active can make the domain unreachable. Re-enable DNSSEC after Cloudflare becomes authoritative.

## Phase 5: Copy the assigned Cloudflare nameservers

Return to Cloudflare:

- [ ] Open **Websites** or **Domains**.
- [ ] Select `tsd.report`.
- [ ] Open **Overview**.
- [ ] Find **Cloudflare Nameservers**.
- [ ] Copy both assigned nameserver values exactly.

They will look similar to:

```text
example-one.ns.cloudflare.com
example-two.ns.cloudflare.com
```

Do not use these example values. Use only the two nameservers displayed for `tsd.report` in your Cloudflare account. Keep the Cloudflare tab open.

## Phase 6: Change the nameservers in GoDaddy

- [ ] Open the [GoDaddy Domain Portfolio](https://dcc.godaddy.com/portfolio).
- [ ] Select `tsd.report`.
- [ ] Select **DNS**.
- [ ] Select **Nameservers**.
- [ ] Select **Change Nameservers**, if shown.
- [ ] Choose **I'll use my own nameservers**.
- [ ] Remove:

  ```text
  ns63.domaincontrol.com
  ns64.domaincontrol.com
  ```

- [ ] Enter the two exact nameservers assigned by Cloudflare.
- [ ] Confirm that only those two Cloudflare nameservers remain.
- [ ] Select **Save**.
- [ ] Select **Continue**.
- [ ] Complete GoDaddy's identity verification using the authenticator, SMS code, or email OTP.

This changes authoritative DNS only. The domain remains registered and renewed through GoDaddy.

Reference: [GoDaddy nameserver instructions](https://www.godaddy.com/en-uk/help/change-my-domain-nameservers-664).

## Phase 7: Ask Cloudflare to verify the change

Return to Cloudflare:

- [ ] Open `tsd.report`.
- [ ] Open **Overview**.
- [ ] Select **Check nameservers now** or **Done, check nameservers**.
- [ ] Wait for the zone status to change from **Pending Nameserver Update** to **Active**.

Activation commonly happens within an hour, but global caches can take up to 24–48 hours to converge. Do not repeatedly change the nameservers while waiting.

Once the zone is active:

- [ ] Open **DNS** → **Records**.
- [ ] Confirm these temporary records still exist:

  ```text
  A      @      15.197.148.33
  A      @      3.33.130.190
  CNAME  www    tsd.report
  ```

- [ ] Confirm these records remain **DNS only**.
- [ ] Open `http://tsd.report`.
- [ ] Open `http://www.tsd.report`.
- [ ] Confirm both names resolve.

They may continue showing GoDaddy's parked page at this stage. That is expected.

From this point onward, manage DNS records in Cloudflare. GoDaddy remains the registrar.

## Phase 8: Re-enable DNSSEC

Do this only after Cloudflare shows the zone as **Active**.

### In Cloudflare

- [ ] Open `tsd.report`.
- [ ] Select **DNS** → **Settings**.
- [ ] Find **DNSSEC**.
- [ ] Select **Enable DNSSEC**.
- [ ] Keep the displayed DS record open.

Cloudflare will provide:

- Key Tag.
- Algorithm.
- Digest Type.
- Digest.

### In GoDaddy

- [ ] Open the GoDaddy Domain Portfolio.
- [ ] Select `tsd.report`.
- [ ] Select **DNS** → **DS Records**.
- [ ] Select **Add**.
- [ ] Copy the **Key Tag** from Cloudflare exactly.
- [ ] Select the matching **Algorithm**.
- [ ] Select the matching **Digest Type**.
- [ ] Copy the **Digest** exactly.
- [ ] Select **Save**.
- [ ] Return to Cloudflare and wait for DNSSEC to show as active.

Reference: [GoDaddy DS-record instructions](https://help-center.dc-aws.godaddy.com/help/add-a-ds-record-23865).

## Phase 9: Leave these settings unchanged until the first Pages deployment

- [ ] Keep the temporary GoDaddy parking A records.
- [ ] Keep the `www` CNAME.
- [ ] Do not manually point `tsd.report` to a guessed Pages IP address.
- [ ] Do not manually create a Pages CNAME before associating the domain through the Pages project.
- [ ] Do not configure redirects yet.
- [ ] Keep domain auto-renew enabled at GoDaddy.

Cloudflare Pages does not provide fixed IP addresses for this connection. After the first deployment, use **Workers & Pages** → the Pages project → **Custom domains** → **Set up a domain**. Cloudflare will create the required DNS record.

Reference: [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Phase 10: Create the Cloudflare credential for GitHub Actions

Use a restricted Cloudflare API token. Do not use the Cloudflare Global API Key.

### Create the API token in Cloudflare

- [ ] Open the Cloudflare profile menu.
- [ ] Select **API Tokens**.
- [ ] Select **Create Token**.
- [ ] Under **Custom Token**, select **Get started**.
- [ ] Set the token name to:

  ```text
  GitHub Actions - tsd.report Pages
  ```

- [ ] Add this permission:

  ```text
  Account → Cloudflare Pages → Edit
  ```

- [ ] Under **Account Resources**, select:

  ```text
  Include → Specific account → the account that owns tsd.report
  ```

- [ ] Do not add Zone DNS permissions.
- [ ] Select **Continue to summary**.
- [ ] Confirm that the token grants only the required Cloudflare Pages permission for the selected account.
- [ ] Select **Create Token**.
- [ ] Copy the token immediately and store it in a password manager until it has been added to GitHub.

Cloudflare displays the token value only once. Do not paste it into chat, source files, documentation, shell history, issue descriptions, pull requests, or workflow YAML.

Reference: [Cloudflare Pages Direct Upload with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

## Phase 11: Store the deployment values in GitHub

Open the GitHub repository and select **Settings** → **Secrets and variables** → **Actions**.

### Repository secret

Open the **Secrets** tab, select **New repository secret**, and add:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | The restricted Cloudflare Pages API token |

### Repository variables

Open the **Variables** tab and add:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID for the account that owns the Pages project |
| `CLOUDFLARE_PROJECT_NAME` | `tsd-report` |

The account ID and project name are identifiers rather than credentials, so store them as GitHub Actions variables. The workflow should expose them to Wrangler as environment variables:

```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_PROJECT_NAME: ${{ vars.CLOUDFLARE_PROJECT_NAME }}
```

The deployment command will use:

```sh
npx wrangler pages deploy dist \
  --project-name "$CLOUDFLARE_PROJECT_NAME"
```

### Zone ID policy

`CLOUDFLARE_ZONE_ID` is not required for Cloudflare Pages Direct Upload and should not be added to the deployment workflow.

If DNS automation is added later, store the Zone ID as a GitHub Actions variable and create a separate API token restricted to:

```text
Zone → DNS → Edit
Zone Resources → Include → Specific zone → tsd.report
```

Do not add DNS permissions to the Pages deployment token.

### Values prohibited from GitHub

Never store any of these in the repository or GitHub Actions:

- Cloudflare Global API Key.
- Cloudflare password.
- Email account password.
- Two-factor authentication seed.
- Recovery codes.
- GoDaddy password or one-time password.
- Domain transfer authorization code.

## Completion state

The DNS migration is complete when all of these are true:

```text
Registrar: GoDaddy
Authoritative DNS: Cloudflare
Cloudflare zone: Active
DNSSEC: Active
Website destination: temporary GoDaddy parking records
Pages domain connection: pending first deployment
GitHub secret: CLOUDFLARE_API_TOKEN configured
GitHub variables: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_PROJECT_NAME configured
```

Record the two assigned Cloudflare nameservers and the activation date in the deployment evidence without storing account credentials or recovery codes.
