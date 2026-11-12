import { defineStorage } from "@aws-amplify/backend"

/**
 * Photo storage (Amazon S3).
 * Each user uploads into their own folders, project-images/<their identity id>/ and
 * portfolio-images/<their identity id>/ (contractors' past work), so they can only add
 * or delete their own photos. Everyone, including signed-out visitors, can view them,
 * since projects and contractor profiles are public.
 */
export const storage = defineStorage({
  name: "workbidPhotos",
  access: (allow) => ({
    "project-images/{entity_id}/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read"]),
      allow.entity("identity").to(["read", "write", "delete"]),
    ],
    "portfolio-images/{entity_id}/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read"]),
      allow.entity("identity").to(["read", "write", "delete"]),
    ],
  }),
})
