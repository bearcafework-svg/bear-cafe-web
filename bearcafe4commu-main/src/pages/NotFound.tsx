import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BearLogo } from "@/components/bear-cafe/BearLogo";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-background dark:via-background dark:to-muted/20 p-4">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-6 sm:mb-8">
          <BearLogo size="lg" noFloat className="mx-auto" />
        </div>
        <h1 className="mb-3 sm:mb-4 text-5xl sm:text-6xl font-bold text-foreground">404</h1>
        <p className="mb-2 text-lg sm:text-xl font-medium text-foreground">หน้าที่คุณต้องการหาไม่พบ</p>
        <p className="mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground">
          ลิงก์อาจเสียหายหรือหน้านี้ถูกลบไปแล้ว 🐻
        </p>
        <Button asChild className="w-full sm:w-auto px-6">
          <Link to="/" className="gap-2">
            <Home className="w-4 h-4" />
            กลับหน้าหลัก
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
