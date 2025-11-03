# GitHub OAuth Setup Instructions

To enable "Login with GitHub" functionality using Device Flow, you need to register a GitHub OAuth App.

## Steps to Register OAuth App

1. **Go to GitHub OAuth Apps settings:**
   - Visit: https://github.com/settings/developers
   - Click "New OAuth App"

2. **Fill in the application details:**
   - **Application name:** `Repo Timeline Visualizer`
   - **Homepage URL:** `https://rjwalters.github.io/repo-timeline`
   - **Application description:** `Visualize how a GitHub repository evolved through pull requests`
   - **Authorization callback URL:** `https://rjwalters.github.io/repo-timeline` (not used for Device Flow, but required)
   - **Enable Device Flow:** ✅ Check this box (IMPORTANT!)

3. **Create the app:**
   - Click "Register application"
   - You'll be shown a **Client ID** - copy this

4. **Update the code:**
   - Open `src/services/githubAuthService.ts`
   - Replace the placeholder CLIENT_ID with your actual Client ID:
     ```typescript
     const CLIENT_ID = "YOUR_CLIENT_ID_HERE";
     ```

5. **Commit and deploy:**
   ```bash
   git add src/services/githubAuthService.ts
   git commit -m "Add GitHub OAuth Client ID"
   git push
   ```

## Important Notes

- **Device Flow** is specifically designed for apps that can't securely store secrets (like static web apps)
- You do NOT need a Client Secret for Device Flow
- The Client ID is public and safe to include in your frontend code
- Users will be prompted to authorize your app on GitHub's website
- The app only requests `public_repo` scope (read access to public repositories)

## Security

- Device Flow is secure because:
  - No secrets in client-side code
  - User authorizes on GitHub's official site
  - Token is only issued after user confirmation
  - Token is stored in browser's localStorage (user's device only)

## Testing

After updating the CLIENT_ID, you can test locally:

```bash
pnpm dev
```

Then click "Login with GitHub" and you should see:
1. A new tab opens to GitHub's authorization page
2. You'll see a code to verify
3. After authorizing, the app will automatically receive the token
4. The UI will show "Authenticated" status
