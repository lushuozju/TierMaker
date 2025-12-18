# 规范化提交并推送到 GitHub

# 检查是否有未提交的更改
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "没有需要提交的更改" -ForegroundColor Yellow
    exit 0
}

# 显示当前状态
Write-Host "`n当前 Git 状态：" -ForegroundColor Cyan
git status --short

# 添加所有更改
Write-Host "`n添加文件到暂存区..." -ForegroundColor Cyan
git add .

# 提交（使用规范化提交信息）
Write-Host "`n提交更改..." -ForegroundColor Cyan
$commitMessage = @"
feat(ui): 重构导出功能和清空数据按钮位置

- 将清空数据按钮从设置移到主界面，提升可访问性
- 统一导出功能为下拉菜单，提供图片、PDF、JSON三个选项
- 优化用户界面布局和交互体验
- 移除设置中的清空数据功能，简化设置界面
"@

git commit -m $commitMessage

# 推送到远程仓库
Write-Host "`n推送到 GitHub..." -ForegroundColor Cyan
git push

Write-Host "`n✅ 提交和推送完成！" -ForegroundColor Green

