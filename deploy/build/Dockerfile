FROM idootop/migpt-next:latest

# Keep credentials outside the image. Mount config.js at /app/config.js when running.
#
# 本目录的 packages/<pkg>/dist 是调优后的编译产物，已随仓库提供，clone 后可直接构建：
#   docker build -t migpt-next:local ./deploy/build
#
# 如果自己改了源码，请先在仓库根目录 npx pnpm@9.15.9 build，再把 4 个产物目录覆盖到本目录：
#   packages/{miot,openai,engine,next}/dist -> deploy/build/packages/{miot,openai,engine,next}/dist
# （只覆盖这 4 个包；chat/config/stream/utils 走基础镜像里的原版）
# 漏了这一步构建出来的仍是旧的调优产物，不是你的改动。
COPY packages/miot/dist/ /app/node_modules/@mi-gpt/miot/dist/
COPY packages/openai/dist/ /app/node_modules/@mi-gpt/openai/dist/
COPY packages/engine/dist/ /app/node_modules/@mi-gpt/engine/dist/
COPY packages/next/dist/ /app/node_modules/@mi-gpt/next/dist/
