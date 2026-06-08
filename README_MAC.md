# 🍎 顿河学院学生测评管理软件 — macOS 版

## 🚀 推荐方式：GitHub Actions 自动构建（无需 Mac）

> **一次配置，每次推送代码云端 Mac 自动编译成 `.dmg`，下载直接发人。**

### 步骤（5 分钟搞定）

```bash
# 1. 在 GitHub 创建仓库（免费私有即可）
#    https://github.com/new
#    仓库名随意，比如 student-evaluation-system

# 2. 推送代码到 GitHub
cd student-evaluation-system
git init
git add .
git commit -m "v7.1 Mac 适配"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main

# 3. 自动开始编译！
#    推送后打开 GitHub 仓库 → Actions 标签
#    你会看到 "Build macOS DMG" 正在运行
#    约 3-5 分钟后完成

# 4. 下载 DMG
#    GitHub → Actions → 点最新的一次运行
#    页面底部 Artifacts → 下载 "顿河学院学生测评管理软件-macOS"
#    解压得到 .dmg，直接发给 Mac 用户
```

### 手动触发构建
- GitHub → Actions → Build macOS DMG → Run workflow → 输入版本号 → 绿色按钮

### 发布 Release（给版本打 tag）
```bash
git tag v7.1.0
git push --tags
# GitHub Actions 会自动创建 Release 页面，DMG 挂在上面
```

---

## 💻 备选：本地 Mac 构建

```bash
chmod +x setup_mac.sh

# 一键安装 + 打包
./setup_mac.sh

# 输出：
#   dist/顿河学院学生测评管理软件.app
#   dist/顿河学院学生测评管理软件.dmg
```

---

## 📋 账号
| 用户 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 秘书处 |
| mishuchu | dunhe521 | 秘书处 |
| fudaoyuan | sdjtu521 | 辅导员 |
