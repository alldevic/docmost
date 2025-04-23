import SettingsTitle from "@/components/settings/settings-title.tsx";
import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import LicenseDetails from "@/ee/licence/components/license-details.tsx";
import InstallationDetails from "@/ee/licence/components/installation-details.tsx";
import OssDetails from "@/ee/licence/components/oss-details.tsx";
import { useAtom } from "jotai/index";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";

export default function License() {
  const [entitlements] = useAtom(entitlementAtom);
  const hasLicense = entitlements != null && entitlements.tier !== "free";
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <SettingsTitle title="License" />

      <InstallationDetails />

      {hasLicense ? <LicenseDetails /> : <OssDetails />}
    </>
  );
}
