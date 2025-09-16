import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { isMockMode } from "@/lib/env";

export default function SignUpPage() {
  if (isMockMode()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 to-black text-center text-white">
        <div>
          <h1 className="text-3xl font-bold">Mock Account Provisioning</h1>
          <p className="mt-2 max-w-md text-gray-400">
            External identity providers are disabled right now. Continue to the demo workspace to explore features without signing up.
          </p>
        </div>
        <Link
          href="/app"
          className="rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-700"
        >
          Continue to Demo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary:
              "bg-violet-600 hover:bg-violet-700 transition-colors",
            footerActionLink:
              "text-violet-500 hover:text-violet-400",
            identityPreviewEditButtonIcon:
              "text-violet-500",
            formFieldInput:
              "border-gray-700 bg-gray-900/50 focus:border-violet-500",
            card:
              "bg-gray-900/90 backdrop-blur-sm border border-gray-800",
            headerTitle:
              "text-white",
            headerSubtitle:
              "text-gray-400",
            socialButtonsBlockButton:
              "bg-gray-800 hover:bg-gray-700 border-gray-700 text-white",
            formFieldLabel:
              "text-gray-300",
            dividerLine:
              "bg-gray-700",
            dividerText:
              "text-gray-400",
            formFieldInputShowPasswordButton:
              "text-gray-400 hover:text-gray-300",
          },
          layout: {
            socialButtonsPlacement: "top",
            socialButtonsVariant: "blockButton",
          },
        }}
        signInUrl="/sign-in"
        forceRedirectUrl="/app"
      />
    </div>
  );
}
