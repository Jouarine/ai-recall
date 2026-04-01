# AI Recall

AI 复习与刷题项目，基于 Next.js + Prisma。

## 本地开发

先准备 PostgreSQL，并设置环境变量：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
```

然后执行：

```bash
npm install
npm run db:push
npm run dev
```

## Vercel 部署

这个项目现在使用 `PostgreSQL`，不再使用本地 `SQLite`。

Vercel 需要配置：

```bash
DATABASE_URL=你的 Postgres 连接串
```

推荐数据库：

- Vercel Postgres
- Neon
- Supabase

部署步骤：

1. 在 Vercel 项目里添加 `DATABASE_URL`
2. 重新部署一次
3. 在本地执行一次：

```bash
npx prisma db push
```

如果你的数据库是云端共享库，也可以在任意能连通数据库的环境执行：

```bash
npx prisma db push
```

## 说明

- 题目、错题、收藏、资料源文本现在都依赖数据库持久化
- 不再依赖本地 `data/*.json` 文件存储
