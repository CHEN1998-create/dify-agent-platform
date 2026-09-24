import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径直接放行
  const publicPaths = ["/login", "/_next", "/favicon.ico"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return (await updateSession(request)).response;
  }

  const { response, user } = await updateSession(request);

  // 未登录 → 跳转登录页
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return Response.redirect(url);
  }

  // 访问管理后台需要 admin 角色
  if (pathname.startsWith("/admin")) {
    const role = user?.user_metadata?.role;
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/agents";
      return Response.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // 排除静态资源和 API
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
