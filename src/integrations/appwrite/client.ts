import { Account, Client, Databases } from "appwrite";

const ENDPOINT = import.meta.env["VITE_APPWRITE_ENDPOINT"];
const PROJECT_ID = import.meta.env["VITE_APPWRITE_PROJECT_ID"];

export const DATABASE_ID = import.meta.env["VITE_APPWRITE_DATABASE_ID"] as string;
export const BOOKMARKS_COLLECTION_ID = import.meta.env[
  "VITE_APPWRITE_BOOKMARKS_COLLECTION_ID"
] as string;

// Appwrite Cloud is a shared host — calling it before a project is configured
// doesn't fail closed, it just hits the real API with no project header. Gate
// every call on this instead of relying on requests to error out.
export const isAppwriteConfigured = Boolean(ENDPOINT && PROJECT_ID);

const client = new Client();
if (isAppwriteConfigured) client.setEndpoint(ENDPOINT).setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
