// /command-center and /canvas were byte-identical copies of the same surface.
// /canvas is the canonical home — this route now just forwards to it.
import { redirect } from "next/navigation";

export default function CommandCenterRedirect() {
  redirect("/canvas");
}
