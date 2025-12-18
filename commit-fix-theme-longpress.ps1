# 提交修复主题设置保存和长按效果样式问题

Set-Location $PSScriptRoot

# 检查是否有未提交的更改
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "没有需要提交的更改" -ForegroundColor Yellow
    exit 0
}

# 添加所有更改
git add .

# 创建提交
git commit -m "fix: 修复主题设置保存和长按效果样式问题

- 修复设置中切换主题时点击空白处退出不保存的问题
- 修复长按效果在浅色模式下显示深色样式的问题
- 调整长按效果不透明度为 0.7，提升可见性"

# 推送到远程仓库
git push origin main

Write-Host "✅ 提交和推送完成" -ForegroundColor Green

