import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Logo size="sm" />
            <p className="text-sm text-gray-500 max-w-xs text-center md:text-left">
              Find businesses. Generate AI systems. Send proposals. Get paid monthly.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <Link href="#how-it-works" className="hover:text-gray-300 transition-colors">How it works</Link>
            <Link href="#pricing" className="hover:text-gray-300 transition-colors">Pricing</Link>
            <Link href="#faq" className="hover:text-gray-300 transition-colors">FAQ</Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Log in</Link>
            <Link href="/signup" className="hover:text-gray-300 transition-colors">Sign up</Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.06] text-center text-xs text-gray-600">
          © {year} LaunchGrid AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
