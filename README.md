# gat

gat 是一个基于 Tauri 构建的现代化 Git 可视化管理工具，支持多仓库管理、AI 辅助提交信息和分支管理。

## 功能特性

- **多仓库管理** - 扫描并管理多个 Git 仓库
- **文件状态查看** - 清晰展示已暂存、未暂存和未跟踪的文件
- **AI 辅助提交** - 支持 DeepSeek 和 GLM API 自动生成提交信息
- **分支管理** - 切换分支、发布分支、查看分支状态
- **批量操作** - 支持多仓库批量提交
- **中文界面** - 全中文用户界面，支持中英文提交信息生成

## 截图

## 安装

### 前置要求

- Node.js 18+
- pnpm
- Rust
- 系统 Git

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/ikun-Lg/gat.git
cd gat

# 安装依赖
pnpm install

# 开发模式运行
pnpm run tauri dev

# 构建生产版本
pnpm run tauri build
```

## 使用说明

### 首次使用

1. 启动应用后，点击"选择项目目录"
2. 选择包含 Git 仓库的根目录
3. 应用会自动扫描并列出所有 Git 仓库

### 提交更改

1. 在左侧仓库列表中选择要操作的仓库
2. 在文件列表中点击文件进行暂存/取消暂存
3. 可使用 AI 生成提交信息，或手动输入
4. 点击"提交"按钮完成提交

### AI 提交信息配置

在设置页面配置 AI 提供商：

- **DeepSeek**: 需要 API Key
- **智谱 GLM**: 需要 API Key

### 分支管理

- 点击分支选择器切换分支
- 未发布的分支会显示"(未发布)"标识
- 点击"发布分支"按钮将分支推送到远程

### 批量操作

1. 在仓库列表中勾选多个仓库
2. 切换到批量操作模式
3. 输入提交信息后批量提交

## 配置文件

配置文件位于 `~/.config/gat/git_credentials.json`，存储：
- Git 凭据（用于发布分支）
- 用户设置

## 开发

### 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **后端**: Rust + Tauri 2.0
- **Git 操作**: git2-rs
- **状态管理**: Zustand
- **构建工具**: Vite

### 项目结构

```
gat/
├── src/              # 前端源码
│   ├── components/   # React 组件
│   ├── store/        # Zustand 状态管理
│   └── types/        # TypeScript 类型定义
└── src-tauri/        # Rust 后端
    ├── src/
    │   ├── commands/ # Tauri 命令
    │   ├── domain/   # 领域模型
    │   └── error.rs  # 错误处理
    └── capabilities/ # 权限配置
```

### 开发命令

```bash
# 开发模式
pnpm run tauri dev

# 构建
pnpm run tauri build

# 前端类型检查
pnpm run tsc

# Rust 代码检查
cd src-tauri && cargo check
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
