import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/supabase/client';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const BUCKET_NAME = 'project-archives';

/**
 * Ensures that the bucket exists and is configured correctly
 */
async function ensureBucketExists() {
  try {
    const { data, error } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);
    if (error || !data) {
      console.log(`[Storage] Storage bucket "${BUCKET_NAME}" not found. Provisioning...`);
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      if (createError) {
        console.error(`[Storage] Failed to create storage bucket:`, createError);
      } else {
        console.log(`[Storage] Successfully provisioned storage bucket "${BUCKET_NAME}".`);
      }
    }
  } catch (err) {
    console.error(`[Storage] Exception while checking bucket existence:`, err);
  }
}

/**
 * Uploads a project archive stream to Supabase Storage
 * @param projectId The project ID
 * @param stream Readable stream (e.g. tar child process output) or Buffer
 * @param archiveName The name of the file inside the bucket (e.g. project-archive.tar.gz)
 * @returns The storage path of the uploaded archive
 */
export async function uploadProjectArchive(
  projectId: string,
  stream: any,
  archiveName: string
): Promise<string> {
  await ensureBucketExists();

  const storagePath = `${projectId}/${archiveName}`;
  console.log(`[Storage] Uploading archive to Supabase Storage: ${storagePath}...`);

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, stream, {
      contentType: 'application/gzip',
      duplex: 'half', // Required for Node streams in undici/fetch
      upsert: true,
    } as any);

  if (error) {
    throw new Error(`Failed to upload archive to Supabase Storage: ${error.message}`);
  }

  return storagePath;
}

/**
 * Retrieves the size of the uploaded archive file in bytes
 * @param projectId The project ID
 * @param archiveName The name of the archive file
 * @returns File size in bytes, or 0 if not found
 */
export async function getArchiveSize(projectId: string, archiveName: string): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(projectId, {
        search: archiveName,
      });

    if (error || !data || data.length === 0) {
      return 0;
    }

    // Find exact match
    const file = data.find((f) => f.name === archiveName);
    return file?.metadata?.size || 0;
  } catch (err) {
    console.error('[Storage] Failed to retrieve archive size:', err);
    return 0;
  }
}

/**
 * Generates a signed download URL for a project archive
 * @param storagePath The relative path of the file in the bucket
 * @returns The signed HTTPS URL string
 */
export async function getDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600); // 1 hour expiration

  if (error || !data) {
    throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
}

/**
 * Deletes a project archive from Supabase Storage
 * @param storagePath The relative path of the file in the bucket
 */
export async function deleteArchive(storagePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error(`[Storage] Failed to delete archive from path "${storagePath}":`, error);
  }
}
