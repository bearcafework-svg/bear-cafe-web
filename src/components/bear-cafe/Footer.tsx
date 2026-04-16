export function Footer() {
  return (
    <footer className="w-full bg-gradient-to-t from-latte/50 to-transparent dark:from-coffee/50 dark:to-transparent border-t border-latte/30 dark:border-coffee/30 py-4 sm:py-6 px-4">
      <div className="max-w-4xl mx-auto text-center space-y-2 sm:space-y-3">
        <p className="text-xs sm:text-sm font-semibold text-foreground">
          © 2026 BEAR CAFE by Zeabiu. All rights reserved.
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
          All illustrations, UI designs, layouts, concepts, visual styles, and creative elements on this website are protected by copyright law.
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
          Unauthorized use, reproduction, imitation, or redistribution in any form is strictly prohibited.
        </p>
      </div>
    </footer>
  );
}
