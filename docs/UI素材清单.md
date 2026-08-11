# 顿河学院学生测评管理软件 — UI 素材清单

> 用于 Gemini Canvas / 设计师 绘制替换素材。每完成一批，告知开发者替换。

---

## 一、核心 Logo（最高优先级）

### `college-logo.png`

- **格式**：PNG，透明背景
- **尺寸**：建议 512×256 像素（宽幅横排），或 256×256（方形）
- **内容**：顿河学院 Logo / 标识
- **使用位置**（全软件 6 处）：登录页(64×64)、欢迎页(120×80)、侧边栏(40×40)、辅导员页头(32×32)、桌面通知图标
- **当前文件**：`web/college-logo.png`

---

## 二、侧边栏导航图标（7个，SVG 格式）

所有图标统一规格：**24×24 viewBox，描边风格，2px 粗细，圆角端点**

### 1. 绩点计算 — 折线图
- **文件名**：`icon-gpa.svg`
- **形状**：坐标轴（L形）+ 上升折线（3个数据点连线）
- **当前**：`<path>` 硬编码在 index.html

### 2. 德育分 — 文档/纸张
- **文件名**：`icon-moral.svg`
- **形状**：纸张轮廓，右上角折角
- **当前**：`<path>` 硬编码在 index.html

### 3. 素拓分 — 五角星
- **文件名**：`icon-quality.svg`
- **形状**：五角星 ⭐
- **当前**：`<polygon>` 硬编码在 index.html

### 4. 综测 — 四格网格
- **文件名**：`icon-comprehensive.svg`
- **形状**：2×2 排列的四个圆角方块 ▦
- **当前**：4个 `<rect>` 硬编码在 index.html

### 5. 设置 — 齿轮
- **文件名**：`icon-settings.svg`
- **形状**：齿轮/太阳，中心圆 + 8根辐条
- **当前**：`<circle>` + `<path>` 硬编码在 index.html

### 6. 返回首页 — 房子
- **文件名**：`icon-home.svg`
- **形状**：三角屋顶 + 矩形房屋主体 🏠
- **当前**：2个 `<path>` 硬编码在 index.html

### 7. 学位帽 — 启动画面 Logo
- **文件名**：`icon-graduation.svg`
- **尺寸**：64×64（启动画面用，比导航图标大）
- **形状**：学位帽（学士帽），梯形帽顶+方形帽板+流苏
- **当前**：`<path>` 硬编码在 index.html

---

## 三、高频功能图标（替代 Emoji，PNG 或 SVG 均可）

这些目前在代码里用系统 Emoji 表示，不同电脑显示效果不一致。统一画成图标。

### 第一批（最急需，出现 10 次以上）

| 图标 | Emoji | 文件名 | 含义 | 出现次数 |
|------|-------|--------|------|----------|
| 文件夹 | 📂 | `icon-folder.svg` | 打开文件夹/浏览文件 | 19 |
| 搜索 | 🔍 | `icon-search.svg` | 搜索/查看/检测 | 12 |
| 灯泡 | 💡 | `icon-tip.svg` | 提示/建议 | 12 |
| 下载 | 📥 | `icon-import.svg` | 导入/下载 | 11 |
| 刷新 | 🔄 | `icon-refresh.svg` | 刷新/更新/同步 | 10 |
| 奖杯 | 🏆 | `icon-rank.svg` | 排名/优胜 | 9 |
| AI | 🤖 | `icon-ai.svg` | AI 助手 | 8 |
| 学校 | 🏫 | `icon-school.svg` | 学院/学校 | 8 |
| 上升 | 📈 | `icon-trend-up.svg` | 上升趋势 | 8 |
| 火箭 | 🚀 | `icon-launch.svg` | 快速/启动 | 6 |
| 靶心 | 🎯 | `icon-target.svg` | 精准/目标 | 6 |

### 第二批（常用）

| 图标 | Emoji | 文件名 | 含义 | 出现次数 |
|------|-------|--------|------|----------|
| 保存 | 💾 | `icon-save.svg` | 保存/导出文件 | 5 |
| 日历 | 📅 | `icon-calendar.svg` | 学期/日期 | 7 |
| 文件 | 📄 | `icon-file.svg` | 文件/文档 | 5 |
| 备忘录 | 📝 | `icon-memo.svg` | 编辑/记录 | 4 |
| 纸张 | 📋 | `icon-clipboard.svg` | 列表/表格 | 23 |
| 人物 | 👤 | `icon-person.svg` | 学生个人信息 | 6 |

### 第三批（状态及操作图标）

| 图标 | Emoji | 文件名 | 含义 |
|------|-------|--------|------|
| 成功 | ✅ | `icon-success.svg` | 操作成功 |
| 错误 | ❌ | `icon-error.svg` | 操作失败 |
| 警告 | ⚠️ | `icon-warning.svg` | 警告提示 |
| 删除 | 🗑 | `icon-delete.svg` | 删除 |
| 添加 | ➕ | `icon-add.svg` | 添加 |
| 编辑 | ✏️ | `icon-edit.svg` | 重命名/编辑 |
| 预览 | 👁 | `icon-preview.svg` | 查看预览 |
| 链接 | 🔗 | `icon-link.svg` | 链接/关联 |
| 邮件 | 📧 | `icon-mail.svg` | 发送通知 |

---

## 四、辅导员后台专属图标

| 图标 | Emoji | 文件名 | 侧边栏标签 |
|------|-------|--------|-----------|
| 邮件 | 📧 | `icon-notices.svg` | 通知工具 |
| 人物 | 👤 | `icon-students.svg` | 学生管理 |
| 图表 | 📊 | `icon-analysis.svg` | 分析中心 |
| 靶心 | 🎯 | `icon-bigscreen.svg` | 班会大屏 |
| 齿轮 | ⚙️ | `icon-settings2.svg` | 设置 |

### 分析中心子标签

| 图标 | Emoji | 文件名 | 标签 |
|------|-------|--------|------|
| 图表 | 📊 | `icon-overview.svg` | 数据总览 |
| 学校 | 🏫 | `icon-grade-compare.svg` | 年级对比 |
| 纸张 | 📋 | `icon-class-analysis.svg` | 班级分析 |
| 下降 | 📉 | `icon-course-analysis.svg` | 成绩分析 |
| 警告 | ⚠️ | `icon-alerts.svg` | 预警中心 |

---

## 五、风险等级指示器

用于标记学生挂科/预警等级：

| 图标 | 颜色 | 文件名 | 含义 |
|------|------|--------|------|
| 🟢 | `#00b894` 绿 | `dot-safe.svg` | 安全 |
| 🟡 | `#fdcb6e` 黄 | `dot-watch.svg` | 关注 |
| 🟠 | `#e17055` 橙 | `dot-alert.svg` | 警告 |
| 🔴 | `#d63031` 红 | `dot-danger.svg` | 危险 |

---

## 六、素材规格统一要求

| 类型 | 格式 | viewBox | 线条 | 颜色 |
|------|------|---------|------|------|
| 导航图标 | SVG | 24×24 | 2px 描边，圆角端点 | `currentColor`（跟随主题变色） |
| 功能图标 | SVG 或 PNG | 20×20 或 24×24 | 1.5-2px | 同上 |
| Logo | PNG | 512px 宽以上 | — | 透明背景 |
| 状态指示器 | SVG | 12×12 | — | 见上方颜色表 |

> **重要**：SVG 图标使用 `stroke="currentColor"` 和 `fill="none"`，这样软件深色/浅色模式下自动切换颜色。

---

## 七、软件当前配色参考

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色调 | `#6c5ce7` 紫 | 按钮、高亮、选中状态 |
| 辅色调 | `#00cec9` 青 | 次要强调、链接 |
| 金色 | `#fdcb6e` 金 | 素拓模块、警告 |
| 成功 | `#00b894` 绿 | 操作成功 |
| 错误 | `#e17055` 橙红 | 操作失败 |
| 危险 | `#d63031` 深红 | 严重警告 |
| 背景深色 | `#0a1020` ~ `#182040` | 深色模式背景层级 |
| 文字 | `#e8e8f0` | 深色模式主文字 |
| 模块色-绩点 | 紫色渐变 | `#6c5ce7` → `#a78bfa` |
| 模块色-德育 | 青色渐变 | `#00cec9` → `#5eead4` |
| 模块色-素拓 | 金色渐变 | `#fdcb6e` → `#fbbf24` |
| 模块色-综测 | 橙色渐变 | `#e17055` → `#fb923c` |

---

## 八、文件目录结构（画好后放这里）

```
web/
  assets/
    icons/
      icon-gpa.svg
      icon-moral.svg
      icon-quality.svg
      icon-comprehensive.svg
      icon-settings.svg
      icon-home.svg
      icon-graduation.svg
      icon-folder.svg
      icon-search.svg
      ...（其余图标）
    indicators/
      dot-safe.svg
      dot-watch.svg
      dot-alert.svg
      dot-danger.svg
  college-logo.png          ← 替换现有文件
```

---

## 提交方式

每画好一批就发过来，按以下分组分批提交：

1. **第1批** — `college-logo.png`（改一个文件全软件见效）
2. **第2批** — 7 个侧边栏导航图标
3. **第3批** — 11 个高频功能图标（第一批）
4. **第4批** — 6 个常用图标（第二批）
5. **第5批** — 9 个状态/操作图标（第三批）
6. **第6批** — 辅导员后台专用图标 + 风险指示器
