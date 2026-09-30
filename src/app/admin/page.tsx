import type { Metadata } from "next";
import { LoginScreen } from "@/components/login-screen";

export const metadata: Metadata = { title: "Masuk Admin" };
export default function AdminLoginPage() { return <LoginScreen area="admin"/>; }
