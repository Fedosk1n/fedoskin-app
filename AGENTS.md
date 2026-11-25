# Publishing the app

Publish requested app changes as soon as they pass verification. GitHub Pages publishes from `main`. Verify the update at https://fedosk1n.github.io/fedoskin-app/ before reporting it live.

# Cloudflare Worker releases

Every change that requires deploying `server/push-worker.js` must include a visible update notice in `admin.html` in the same pull request.

- Increment `WORKER_VERSION` in the Worker. Set `REQUIRED_WORKER_VERSION` in the admin to the same value and bump the displayed admin version.
- Update the notice to name the change that requires the deploy. Keep the copy, download, and recheck controls working.
- Verify the notice is visible when the admin opens with an older Worker and clears after the updated Worker reports its version. Mention the required deployment in the PR and in the handoff.
