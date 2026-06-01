# 国象 × 将棋 · 9×9 融合对战

国际象棋 × 将棋 放进同一张 9×9 棋盘的在线对战游戏,融入楚河汉界元素。支持本地同屏与联机大厅(注册 / 游客登录、头像、开房、邀请、实时对战)。

## 结构(npm workspaces)

- `shared/` — 纯 TS 规则引擎 + 类型 + 网络消息定义(前后端共用)
- `client/` — Vite + React + TS 前端
- `server/` — Node + Express + Socket.IO 后端(权威校验 + 大厅 + 账号)

## 本地开发(Windows PowerShell)

1. 打开 PowerShell,进入项目目录:`cd C:\Users\david\chess-shogi`
2. 首次安装依赖:输入 `npm install`,回车,等装完。
3. 开**第一个**终端跑后端:输入 `npm run server`,回车(监听 `:3001`)。
4. 再开**第二个** PowerShell 终端(在同一目录),跑前端:输入 `npm run dev`,回车(监听 `:5173`)。
5. 浏览器打开 `http://localhost:5173/`。联机测试:再开一个浏览器标签同样打开,即可两人对战。

## 测试

- 全部:`npm test`
- 规则引擎:`npm run test -w @cs/shared`(走子/吃子/双 King/打入/升变/将死)
- 服务器联机:`npm run test -w server`(两客户端开房 + 落子同步)

## 部署(Railway)

生产模式下后端同时托管前端静态文件(同源),只需一个服务。

1. 推到 GitHub 仓库。
2. Railway 新建项目 → 从该仓库部署。Nixpacks 会自动 `npm install` → `npm run build`(打包前端到 `client/dist`)→ `npm start`(启动后端并托管前端)。
3. 环境变量:
   - `PORT` — Railway 自动注入。
   - `AUTH_SECRET` — 设一个随机串(token 签名密钥)。
   - `DATA_DIR` — 账号持久化目录;**想让账号在重新部署后不丢,需挂一个 Railway Volume 并把 `DATA_DIR` 指到挂载路径(如 `/data`)**。不挂卷则每次重新部署账号会清空(游客与对战不受影响)。

## 已知简化(后续可补)

王车易位、吃过路兵、将棋打步诘禁手暂未实现,不影响正常对弈。
