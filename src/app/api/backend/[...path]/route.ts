import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function forward(request: NextRequest, context: RouteContext) {
  const backendApiUrl = process.env.BACKEND_API_URL;

  if (!backendApiUrl) {
    return NextResponse.json(
      { error: "BACKEND_API_URL is not configured" },
      { status: 500 },
    );
  }

  const { path } = await context.params;

  const baseUrl = backendApiUrl.endsWith("/")
    ? backendApiUrl
    : `${backendApiUrl}/`;

  const targetUrl = new URL(path.join("/"), baseUrl);

  // ?foo=bar などがあれば、そのままSpring Bootへ渡す
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers();

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers();

  const responseContentType = response.headers.get("content-type");
  if (responseContentType) {
    responseHeaders.set("content-type", responseContentType);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
