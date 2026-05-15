# OCI GitHub Actions Deployment

This repository deploys directly to an OCI VM without Docker:

1. `pull_request` to `main`: install, test, typecheck, and build.
2. `push` to `main` or manual `workflow_dispatch`: build `dist`, upload a tarball to the VM, install production dependencies with pnpm, run Drizzle migrations, switch the `current` symlink, restart `systemd`, and verify `/login` on port `3000`.

The VM needs only Node.js, Corepack/pnpm, systemd, SSH access, and the existing private MySQL setup.

Keep `DATABASE_URL` pointed at the VM-local MySQL endpoint:

```env
DATABASE_URL=mysql://app_user:password@127.0.0.1:3306/app_db
```

Do not open MySQL port `3306` publicly.

## One-time OCI VM setup

Run this on the Oracle Linux VM as `opc`:

```sh
curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
sudo dnf install -y nodejs
sudo corepack enable
node --version
corepack pnpm --version
```

Open the app port in OCI security rules and the VM firewall if needed:

```sh
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

Keep port `3000` free for this app. The first deployment contract requires the app to answer on `http://<server-ip>:3000/login`; binding to another port does not count as success.

The workflow creates and maintains:

```text
/home/opc/stock-dashboard/current
/home/opc/stock-dashboard/releases/<git-sha>
/home/opc/stock-dashboard/shared/pnpm-store
/etc/systemd/system/stock-dashboard.service
```

## GitHub production secrets

Create these in `Settings -> Secrets and variables -> Actions`, preferably under a `production` environment:

```text
OCI_SSH_HOST          public IPv4 or DNS name of the OCI VM
OCI_SSH_PRIVATE_KEY   private key that can SSH into the VM
OCI_SSH_USER          optional, defaults to opc
OCI_SSH_PORT          optional, defaults to 22
OCI_DEPLOY_DIR        optional, defaults to /home/opc/stock-dashboard

DATABASE_URL          mysql://app_user:password@127.0.0.1:3306/app_db
JWT_SECRET            long random secret for auth cookies/JWTs
OPENAI_API_KEY        OpenAI API key used by analysis features
OPENAI_MODEL          optional, defaults to gpt-4o-mini
OWNER_OPEN_ID         optional owner/admin identifier
PORT                  optional, but must be unset or exactly 3000
```

Generate a strong `JWT_SECRET` with:

```sh
openssl rand -base64 48
```

## Deployment files

- `.github/workflows/deploy.yml`: CI/CD pipeline.
- `deploy/stock-dashboard.service`: systemd service template.
- `server/_core/migrate.ts`: production migration runner used before each restart.

Useful VM commands after the first deployment:

```sh
sudo systemctl is-active stock-dashboard
sudo systemctl status stock-dashboard
sudo journalctl -u stock-dashboard -f
curl --fail --show-error http://127.0.0.1:3000/login
ls -la /home/opc/stock-dashboard/current
```

The GitHub deploy job also checks `http://<OCI_SSH_HOST>:3000/login` from the runner. If that external check fails while the VM-local curl succeeds, check the OCI security list and the VM firewall for port `3000`. Do not open MySQL port `3306`.
