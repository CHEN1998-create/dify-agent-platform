import { type NextRequest } from "next/server";

export async function middleware(_request: NextRequest) {
  // 纯前端鉴权架构：不在这里做 Supabase fetch
  // 路由保护由客户端 AuthGuard 组件完成
  // 这里只是让 Next.js 默认处理所有请求
  return;
}

export const config = {
  // 只拦截关键路径，避免影响静态资源
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
