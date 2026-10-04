import {
  Activity,
  Building2,
  Camera,
  ClipboardList,
  HandHeart,
  Inbox,
  LayoutDashboard,
  LocateFixed,
  Megaphone,
  Radar,
  Route,
  ScrollText,
  ShieldCheck,
  Timer,
  Users,
  Vote,
  Wallet,
} from "lucide-react";
import { FEATURES } from "../../brand";

// Sidebar navigation. Each item is shown only when the signed-in
// user holds `permission` (and, when given, has one of `roles`).
// Permissions come from the API, so the menu always matches what
// the server will actually allow.
export const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      {
        to: "/citizen",
        label: "Home",
        icon: LayoutDashboard,
        roles: ["CITIZEN"],
        end: true,
      },
      {
        to: "/citizen/complaints",
        label: FEATURES.myCases,
        icon: ClipboardList,
        permission: "complaint:read:own",
      },
      {
        to: "/authority",
        label: FEATURES.crewQueue,
        icon: ClipboardList,
        roles: ["AUTHORITY"],
        end: true,
      },
      {
        to: "/authority/report",
        label: FEATURES.patrolLog,
        icon: Camera,
        permission: "field:report",
        roles: ["AUTHORITY"],
      },
      {
        to: "/admin",
        label: FEATURES.commandDeck,
        icon: LayoutDashboard,
        roles: ["ADMIN"],
        end: true,
      },
      {
        to: "/admin/issues",
        label: FEATURES.caseDesk,
        icon: Inbox,
        permission: "issue:read:all",
      },
      {
        to: "/admin/assignments",
        label: FEATURES.dispatch,
        icon: Route,
        permission: "assignment:read:all",
      },
      {
        to: "/admin/sla",
        label: FEATURES.fixClock,
        icon: Timer,
        permission: "sla:manage",
      },
    ],
  },
  {
    label: "City",
    items: [
      {
        to: "/issues",
        label: FEATURES.radar,
        icon: Radar,
      },
      {
        to: "/pulse",
        label: FEATURES.pulse,
        icon: Activity,
      },
      {
        to: "/budgets",
        label: FEATURES.budgets,
        icon: Wallet,
        permission: "budget:read",
      },
    ],
  },
  {
    label: "Community",
    items: [
      {
        to: "/bulletins",
        label: FEATURES.bulletins,
        icon: Megaphone,
      },
      {
        to: "/watch-zones",
        label: FEATURES.watchZones,
        icon: LocateFixed,
        permission: "watchzone:manage",
      },
      {
        to: "/polls",
        label: FEATURES.wardVote,
        icon: Vote,
      },
      {
        to: "/drives",
        label: FEATURES.drives,
        icon: HandHeart,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        to: "/admin/organization",
        label: FEATURES.orgRouting,
        icon: Building2,
        permission: "org:manage",
      },
      {
        to: "/admin/users",
        label: FEATURES.accessControl,
        icon: Users,
        permission: "user:manage",
      },
      {
        to: "/admin/access",
        label: FEATURES.permissions,
        icon: ShieldCheck,
        permission: "rbac:read",
      },
      {
        to: "/admin/audit",
        label: FEATURES.paperTrail,
        icon: ScrollText,
        permission: "audit:read",
      },
    ],
  },
];

export function visibleGroups(user, can) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!item.roles || item.roles.includes(user?.role)) &&
        (!item.permission || can(item.permission))
    ),
  })).filter((group) => group.items.length > 0);
}

// Public header links (signed-out visitors).
export const PUBLIC_LINKS = [
  { to: "/issues", label: FEATURES.radar },
  { to: "/pulse", label: FEATURES.pulse },
  { to: "/bulletins", label: "Bulletins" },
  { to: "/polls", label: FEATURES.wardVote },
  { to: "/drives", label: "Drives" },
];

export const ROLE_LABEL = {
  CITIZEN: "Citizen",
  AUTHORITY: "Officer",
  ADMIN: "Admin",
};
