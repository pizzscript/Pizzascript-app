import { Suspense } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

async function Form({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const { error } = await searchParams;
  return <LoginForm error={typeof error === "string" ? error : undefined} />;
}

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="flex flex-col items-center gap-8 w-full">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <h1 className="s-serif text-2xl">Studio</h1>
        </div>
        <Suspense fallback={<div className="h-[124px]" />}>
          <Form searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
