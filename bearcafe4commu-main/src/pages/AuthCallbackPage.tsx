import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, UserX, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingPage } from "@/components/bear-cafe/LoadingBear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BearLogo } from "@/components/bear-cafe/BearLogo";

const DISCORD_INVITE_LINK = "https://discord.gg/bearcafe";
const SUPPORT_LINK = "https://discord.com/channels/1144251788493602848/1148595919785300070";

const SUCCESS_REDIRECT_DELAY_MS = 2000;
const CALLBACK_TIMEOUT_MS = 15000;

type Status = "loading" | "success" | "error";

type ErrorType =
  | "not_member"
  | "banned_admin"
  | "banned_role"
  | "oauth_invalid_code"
  | "oauth_exchange_failed"
  | "internal_error"
  | "unknown";

type ActionType = "link" | "navigate" | "retry";

type UIAction = {
  label: string;
  type: ActionType;
  href?: string;
  to?: string;
};

type ErrorUI = {
  title: string;
  desc: string;
  actions: UIAction[];
};

const DEFAULT_ERROR_MESSAGE = "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

const mapErrorToUI = (errorType: ErrorType, fallbackMessage?: string): ErrorUI => {
  const commonRetryAction: UIAction = { label: "ลองใหม่", type: "retry" };
  const homeAction: UIAction = { label: "กลับหน้าแรก", type: "navigate", to: "/" };

  switch (errorType) {
    case "not_member":
      return {
        title: "ยังไม่ได้เข้าร่วมเซิร์ฟเวอร์",
        desc: "ต้องเข้าร่วมเซิร์ฟเวอร์ก่อนจึงจะใช้งานได้",
        actions: [
          { label: "เข้าร่วมเซิร์ฟเวอร์", type: "link", href: DISCORD_INVITE_LINK },
          { label: "ลองใหม่", type: "retry" },
        ],
      };
    case "banned_admin":
      return {
        title: "บัญชีถูกระงับโดยผู้ดูแล",
        desc: "หากคิดว่าเป็นความผิดพลาด สามารถติดต่อทีมงานได้",
        actions: [
          { label: "สอบถาม-แจ้งปัญหา", type: "link", href: SUPPORT_LINK },
          homeAction,
        ],
      };
    case "banned_role":
      return {
        title: "ไม่สามารถยืนยันตัวตนได้",
        desc: "ระบบตรวจพบ role ที่ถูกตั้งเป็น banrole ตามกฎของเซิร์ฟเวอร์",
        actions: [
          { label: "สอบถาม-แจ้งปัญหา", type: "link", href: SUPPORT_LINK },
          homeAction,
        ],
      };
    case "oauth_invalid_code":
    case "oauth_exchange_failed":
      return {
        title: "ลิงก์ยืนยันหมดอายุหรือไม่ถูกต้อง",
        desc: "กรุณาลองยืนยันตัวตนใหม่อีกครั้ง",
        actions: [commonRetryAction, homeAction],
      };
    case "internal_error":
    case "unknown":
    default:
      return {
        title: "ยืนยันตัวตนไม่สำเร็จ",
        desc: fallbackMessage || "กรุณาลองใหม่อีกครั้ง หรือกลับมาภายหลัง",
        actions: [commonRetryAction, homeAction],
      };
  }
};

const getErrorType = (rawType?: string): ErrorType => {
  const normalized = rawType?.toLowerCase();
  switch (normalized) {
    case "not_member":
      return "not_member";
    case "banned_admin":
      return "banned_admin";
    case "banned_role":
      return "banned_role";
    case "oauth_invalid_code":
      return "oauth_invalid_code";
    case "oauth_exchange_failed":
      return "oauth_exchange_failed";
    case "internal_error":
      return "internal_error";
    default:
      return "unknown";
  }
};

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorType, setErrorType] = useState<ErrorType | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [debugId, setDebugId] = useState<string | undefined>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timeoutRef = useRef<number | null>(null);
  const lastCallbackKeyRef = useRef<string | null>(null);
  const activeRequestRef = useRef(0);

  const callbackParams = useMemo(() => {
    return {
      code: searchParams.get("code"),
      errorParam: searchParams.get("error"),
    };
  }, [searchParams]);

  const clearRedirectTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const goToLogin = useCallback(() => {
    clearRedirectTimeout();
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleError = useCallback(
    ({
      type,
      message,
      debug,
    }: {
      type: ErrorType;
      message?: string;
      debug?: string;
    }) => {
      setStatus("error");
      setErrorType(type);
      setErrorMessage(message);
      setDebugId(debug);
      if (debug) {
        console.info("[AuthCallback] debugId:", debug);
      }
    },
    [],
  );

  const handleCallback = useCallback(async () => {
    clearRedirectTimeout();
    setStatus("loading");
    setErrorType(undefined);
    setErrorMessage(undefined);
    setDebugId(undefined);

    const { code, errorParam } = callbackParams;
    const callbackKey = `${code ?? "no-code"}:${errorParam ?? "no-error"}`;
    if (lastCallbackKeyRef.current === callbackKey) {
      return;
    }
    lastCallbackKeyRef.current = callbackKey;
    activeRequestRef.current += 1;
    const requestId = activeRequestRef.current;

    if (errorParam) {
      handleError({ type: "oauth_invalid_code" });
      return;
    }

    if (!code) {
      handleError({ type: "oauth_invalid_code" });
      return;
    }

    try {
      const response = await Promise.race([
        supabase.functions.invoke("discord-callback", {
          body: { code, redirectUri: `${window.location.origin}/auth/callback` },
        }),
        new Promise<{ timedOut: true }>((resolve) => {
          window.setTimeout(() => resolve({ timedOut: true }), CALLBACK_TIMEOUT_MS);
        }),
      ]);

      if (requestId !== activeRequestRef.current) {
        return;
      }

      if ("timedOut" in response) {
        handleError({
          type: "internal_error",
          message: "การยืนยันตัวตนใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง",
        });
        return;
      }

      if (response.error || response.data?.ok === false || response.data?.error_type) {
        console.error("[AuthCallback] Callback error:", response.data || response.error);
        const errorTypeFromServer = response.data?.error_type;
        const normalizedErrorType = getErrorType(errorTypeFromServer);
        const fallbackMessage =
          normalizedErrorType === "unknown" ? DEFAULT_ERROR_MESSAGE : undefined;
        handleError({
          type: normalizedErrorType,
          message: fallbackMessage,
          debug: response.data?.debug_id || response.data?.debugId,
        });
        return;
      }

      const { session: sessionData, profile: profileData } = response.data || {};

      if (!sessionData?.access_token) {
        handleError({ type: "internal_error" });
        return;
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });

      if (setSessionError) {
        console.error("[AuthCallback] Failed to set session:", setSessionError);
        handleError({ type: "internal_error" });
        return;
      }

      if (profileData?.is_banned) {
        await supabase.auth.signOut();
        handleError({ type: "banned_admin" });
        return;
      }

      setStatus("success");
      timeoutRef.current = window.setTimeout(() => {
        navigate("/", { replace: true });
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch (err) {
      console.error("[AuthCallback] Callback processing error:", err);
      handleError({ type: "internal_error" });
    }
  }, [callbackParams, handleError, navigate]);

  useEffect(() => {
    handleCallback();
    return () => {
      clearRedirectTimeout();
    };
  }, [handleCallback]);

  const errorUI = useMemo(() => {
    if (status !== "error" || !errorType) return null;
    return mapErrorToUI(errorType, errorMessage);
  }, [errorType, errorMessage, status]);

  if (status === "loading") {
    return <LoadingPage message={"กำลังยืนยันตัวตนกับ Discord..."} />;
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-background bg-pattern-dots flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-cream animate-fade-in">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <CardTitle className="font-display text-xl text-foreground">
              ยืนยันตัวตนสำเร็จ
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">กำลังพาไปต่อ...</p>
            <Button onClick={() => navigate("/", { replace: true })} className="w-full">
              ไปต่อ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-pattern-dots flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-cream animate-fade-in">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            {errorType === "not_member" ? (
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <UserX className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>
            ) : errorType === "banned_admin" || errorType === "banned_role" ? (
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
            ) : (
              <BearLogo size="lg" />
            )}
          </div>
          <CardTitle className="font-display text-xl text-foreground">
            {errorUI?.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{errorUI?.desc}</p>
          <div className="space-y-3">
            {errorUI?.actions.map((action) => {
              if (action.type === "link" && action.href) {
                return (
                  <Button
                    key={action.label}
                    asChild
                    className="w-full h-12 text-base font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white"
                  >
                    <a href={action.href} target="_blank" rel="noopener noreferrer">
                      {action.label}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                );
              }

              if (action.type === "navigate" && action.to) {
                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    onClick={() => navigate(action.to!, { replace: true })}
                    className="w-full"
                  >
                    {action.label}
                  </Button>
                );
              }

              return (
                <Button key={action.label} variant="outline" onClick={goToLogin} className="w-full">
                  {action.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
