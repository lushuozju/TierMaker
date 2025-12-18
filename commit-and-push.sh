#!/bin/bash

# 规范化提交并推送到 GitHub

# 检查是否有未提交的更改
if [ -z "$(git status --porcelain)" ]; then
    echo "没有需要提交的更改"
    exit 0
fi

# 显示当前状态
echo "当前 Git 状态："
git status --short

# 添加所有更改
echo ""
echo "添加文件到暂存区..."
git add .

# 提交（使用规范化提交信息）
echo ""
echo "提交更改..."
git commit -m "feat(ui): 重构导出功能和清空数据按钮位置

- 将清空数据按钮从设置移到主界面，提升可访问性
- 统一导出功能为下拉菜单，提供图片、PDF、JSON三个选项
- 优化用户界面布局和交互体验
- 移除设置中的清空数据功能，简化设置界面"

# 推送到远程仓库
echo ""
echo "推送到 GitHub..."
git push

echo ""
echo "✅ 提交和推送完成！"

