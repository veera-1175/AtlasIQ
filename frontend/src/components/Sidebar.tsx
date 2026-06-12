import { UserProfile } from "../api";

import { Page, roleLabel } from "../roles";

import UserAvatar from "./UserAvatar";

import {

  AtlasLogo, IconChart, IconDatabase, IconGrid, IconHistory, IconQuery, IconReport, IconShield,

} from "./Icons";



export type { Page };



interface NavItem { id: Page; label: string; Icon: () => JSX.Element }

interface NavGroup { title: string; items: NavItem[]; admin?: boolean }



interface SidebarProps {

  page: Page;

  onNavigate: (p: Page) => void;

  user: UserProfile;

  onLogout: () => void;

}



function roleBadgeClass(role: string): string {

  if (role === "super_admin") return "role-badge role-badge-super";

  if (role === "company_admin") return "role-badge role-badge-admin";

  return "role-badge role-badge-employee";

}



function navGroups(user: UserProfile): NavGroup[] {

  const isSuperAdmin = user.platform_role === "super_admin";

  const isCompanyAdmin = user.platform_role === "company_admin";
  const isEmployee = user.platform_role === "employee";

  if (isSuperAdmin) {

    return [{

      title: "Platform Operations",

      admin: true,

      items: [

        { id: "platform-dashboard", label: "Command Center", Icon: IconGrid },

        { id: "platform-clients", label: "Client Companies", Icon: IconShield },

        { id: "platform-analytics", label: "Usage Analytics", Icon: IconChart },

        { id: "platform-audit", label: "Audit & Compliance", Icon: IconHistory },

      ],

    }];

  }



  const workspace: NavGroup = {

    title: "Workspace",

    items: [

      { id: "overview", label: "Overview", Icon: IconGrid },

      { id: "analytics", label: "Query Studio", Icon: IconQuery },

      { id: "schema", label: "Schema", Icon: IconDatabase },

      { id: "history", label: "History", Icon: IconHistory },

      ...(isEmployee ? [{ id: "my-usage" as const, label: "My Usage", Icon: IconChart }] : []),

      { id: "reports", label: "Reports", Icon: IconReport },

    ],

  };

  if (!isCompanyAdmin) return [workspace];



  return [

    workspace,

    {

      title: "Administration",

      admin: true,

      items: [

        { id: "databases", label: "Data Sources", Icon: IconDatabase },

        { id: "admin-team", label: "Team & Access", Icon: IconShield },

        { id: "admin-activity", label: "Employee Activity", Icon: IconQuery },

        { id: "admin-analytics", label: "Usage Analytics", Icon: IconChart },

        { id: "admin-audit", label: "Audit Log", Icon: IconHistory },

      ],

    },

  ];

}



export default function Sidebar({ page, onNavigate, user, onLogout }: SidebarProps) {

  const groups = navGroups(user);



  return (

    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-ink-700 bg-black">

      <div className="shell-header-side group">

        <div className="flex items-center gap-3">

          <AtlasLogo className="atlas-logo h-9 w-9" />

          <div>

            <p className="text-lg font-bold tracking-tight text-white">AtlasIQ</p>

            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-300">Intelligence Platform</p>

          </div>

        </div>

      </div>



      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">

        {groups.map((group) => (

          <div key={group.title} className={group.admin ? "nav-admin-group" : "mb-4"}>

            <p className="mono-label px-6 py-2 text-[9px]">

              {group.title}

              {group.admin && <span className="admin-badge">ADMIN</span>}

            </p>

            <div className="space-y-0.5">

              {group.items.map(({ id, label, Icon }) => (

                <button

                  key={id}

                  type="button"

                  onClick={() => onNavigate(id)}

                  className={page === id ? "nav-active w-full" : "nav-idle w-full"}

                >

                  <span className="nav-icon transition-transform duration-300"><Icon /></span>

                  {label}

                </button>

              ))}

            </div>

          </div>

        ))}

      </nav>



      <div className="shrink-0 border-t border-ink-700 bg-black p-4">

        {user.platform_role === "company_admin" ? (
          <button
            type="button"
            onClick={() => onNavigate("admin-profile")}
            className={`flex w-full items-center gap-3 rounded-none border p-3 text-left transition-all duration-300 ${
              page === "admin-profile"
                ? "border-white bg-white/[0.08]"
                : "border-ink-700 bg-white/[0.03] hover:border-ink-400 hover:bg-white/[0.06]"
            }`}
          >
            <UserAvatar
              avatarUrl={user.avatar_url}
              label={user.full_name || user.email}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.full_name || user.email}</p>
              <p className={roleBadgeClass(user.platform_role)}>{roleLabel(user.platform_role)}</p>
              {user.company_name && <p className="truncate text-[10px] text-ink-300">{user.company_name}</p>}
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate("employee-profile")}
            className={`flex w-full items-center gap-3 rounded-none border p-3 text-left transition-all duration-300 ${
              page === "employee-profile"
                ? "border-white bg-white/[0.08]"
                : "border-ink-700 bg-white/[0.03] hover:border-ink-400 hover:bg-white/[0.06]"
            }`}
          >
            <UserAvatar
              avatarUrl={user.avatar_url}
              label={user.full_name || user.email}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.full_name || user.email}</p>
              <p className={roleBadgeClass(user.platform_role)}>{roleLabel(user.platform_role)}</p>
              {user.company_name && <p className="truncate text-[10px] text-ink-300">{user.company_name}</p>}
            </div>
          </button>
        )}

        <button type="button" onClick={onLogout} className="btn-signout">

          Sign out

        </button>

      </div>

    </aside>

  );

}

