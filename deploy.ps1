# deploy.ps1
# Clean, safe deployment of Vite app to GitHub Pages (Windows friendly)

# 1. Build
npm run build

# 2. Save current branch
$currentBranch = git rev-parse --abbrev-ref HEAD

# 3. Switch to gh-pages branch (or create it clean if it doesn't exist)
if (git show-ref --verify --quiet refs/heads/gh-pages) {
    git checkout gh-pages
    git reset --hard
} else {
    git checkout --orphan gh-pages
    git reset --hard
}

# 4. Remove everything in branch except .git
Get-ChildItem -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force

# 5. Copy dist/ contents to branch root
Copy-Item -Recurse -Force .\dist\* .\

# 6. Stage & commit
git add .
git commit -m "Deploy latest build"

# 7. Push to origin gh-pages
git push origin gh-pages --force

# 8. Return to previous branch
git checkout $currentBranch
