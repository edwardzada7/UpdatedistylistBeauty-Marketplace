import { Link } from "react-router-dom";

/**
 * Phase 8 - global compliance footer.
 * Rendered on Home, Providers, Services, Feed, Signup, Login.
 */
const APP_NAME = "iStylist";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-12 border-t border-gray-200 bg-white text-gray-600"
      data-testid="global-footer"
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
          <Link to="/privacy" className="hover:text-purple-600" data-testid="footer-privacy">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-purple-600" data-testid="footer-terms">
            Terms
          </Link>
          <Link to="/community-guidelines" className="hover:text-purple-600" data-testid="footer-guidelines">
            Community Guidelines
          </Link>
          <Link to="/refund-policy" className="hover:text-purple-600" data-testid="footer-refund">
            Refund Policy
          </Link>
          <Link to="/safety" className="hover:text-purple-600" data-testid="footer-safety">
            Safety Center
          </Link>
          <Link to="/support" className="hover:text-purple-600" data-testid="footer-support">
            Support
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          © {year} {APP_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
