This is the Next.js + Tailwind frontend for the GUI Container Manager. It talks to the Django backend for REST API and WebSockets.

## Getting Started

1. Copy `.env.local.example` to `.env.local` (or create `.env.local`) and set:
   - `NEXT_PUBLIC_API_ORIGIN=http://localhost:8000` when the Django backend runs on a different port (e.g. frontend on 3000, backend on 8000). If frontend and API are served from the same origin, this can be omitted.
2. Ensure the Django backend is running and allows CORS from the frontend origin when using a separate dev server.
3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login` or `/dashboard/containers` depending on auth state.

- **Login** (`/login`): username/password → JWT stored in localStorage.
- **Containers** (`/dashboard/containers`): list, create, start/stop/restart/remove, NoVNC, Console, Attach.
- **Console** (`/dashboard/console/shell/[id]`, `/dashboard/console/attach/[id]`): xterm WebSocket terminal.
- **Images** (`/dashboard/images`): list images (read-only).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
