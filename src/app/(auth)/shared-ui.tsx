import type { CSSProperties } from 'react';

export const BRAND_NAME = 'Architectural Intelligence';

const DOT_PATTERN_STYLE: CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
  backgroundSize: '40px 40px',
};

const LEGAL_LINKS = ['Privacy Policy', 'Terms of Service', 'Security', 'Contact Support'] as const;

type AuthFooterLinksProps = {
  containerClassName: string;
  linksWrapperClassName?: string;
  linkClassName: string;
};

type UserAvatarStackProps = {
  avatarClassName: string;
  iconClassName: string;
};

export function AuthBackground() {
  return (
    <>
      <div className="absolute inset-0 z-0 bg-architectural-overlay" />
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={DOT_PATTERN_STYLE} />
    </>
  );
}

export function AuthFooterLinks({ containerClassName, linksWrapperClassName, linkClassName }: AuthFooterLinksProps) {
  return (
    <footer className={containerClassName}>
      <div className={linksWrapperClassName}>
        {LEGAL_LINKS.map((item) => (
          <a key={item} href="#" className={linkClassName}>
            {item}
          </a>
        ))}
      </div>
    </footer>
  );
}

export function UserAvatarStack({ avatarClassName, iconClassName }: UserAvatarStackProps) {
  return (
    <div className="flex -space-x-2">
      {[0, 1, 2].map((item) => (
        <div key={item} className={avatarClassName}>
          <svg className={iconClassName} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
      ))}
    </div>
  );
}
