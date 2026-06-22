# Suara backend — the exact `pnpm serve` Node server you run locally, containerized for
# any Node host (Render / Railway / Fly / Cloud Run). No Deno, no bundling: the workspace
# TS runs under tsx just like in dev. Secrets are injected by the host's environment.

FROM node:22-slim
WORKDIR /app

# pnpm is pinned by package.json's "packageManager"; corepack provisions that exact version.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install against the committed lockfile. Full workspace so tsx + @suara/* are present.
COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
# serve.mts binds process.env.PORT (hosts inject it); 8787 is the local default.
ENV PORT=8787
EXPOSE 8787

CMD ["pnpm", "serve"]
