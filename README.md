# 顿河学院学生测评管理软件

面向学院秘书处、辅导员和班级测评工作的桌面工具，集中处理学分绩点、德育分、素质拓展分、综合测评、材料识别与金山文档云表同步。

当前版本：`v14.1.2`

## 下载

- [下载最新 Windows 安装包与更新文件](https://github.com/Chenmark643/student-evaluation-system/releases/latest)
- macOS 构建由 GitHub Actions 自动生成；Windows 程序支持启动时检查更新、校验 SHA-256 后下载并安全替换。

## 主要能力

- 德育项目可按实际需要选择，不再要求所有模板都上传后才能导出。
- 素拓材料支持规则预设、名单识别、批量录入、重复项检查与分类封顶。
- 学分绩点、德育、素拓和综测均支持专业范围筛选。
- 学年排名可合并两个学期的绩点表或综测表，分别生成班级和专业排名百分比；学年可修改，导出时按当前专业严格筛选。
- 金山文档 CLI 组件可自动检查升级，云表支持绑定、增量更新和工作表整理。
- Windows 提供轻量安装包、含 WebView2 的完整离线安装包，以及程序内在线更新；GitHub 直连不可用时，会在两个国内镜像的版本清单一致后再下载并校验更新。

## 本地开发

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python main.py
```

运行测试：

```powershell
python -m unittest discover -s tests
```

构建 Windows 单文件程序：

```powershell
python -m PyInstaller --clean --noconfirm build.spec
```

制作轻量版或完整离线安装包时，见 [安装程序制作说明](installer/README.md)。

## 发布与在线更新

推送 `v*` 标签后，GitHub Actions 会构建对应平台产物并发布到 GitHub Release；Windows 也可推送与 `config.py` 版本一致的 `release-v*` 分支触发发布。客户端核对版本、文件大小和 SHA-256 后才允许安装，并使用原子替换与备份回滚保护主程序。详细流程见 [在线更新发布说明](docs/在线更新发布说明.md)。

仓库不会提交学生名单、成绩表、云文档临时数据、历史安装包、虚拟环境或本机构建缓存。
