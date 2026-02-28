/**
 * Drive Service — Upload, download, and serve files from Google Drive.
 */

export interface DriveService {
  uploadImage(
    base64Data: string,
    folderId: string,
    options?: { prefix?: string; maxSizeBytes?: number }
  ): { success: boolean; fileId?: string; message?: string };

  getFileAsBase64(fileId: string): string | null;

  deleteFile(fileId: string): boolean;

  createOrGetFolder(folderName?: string): { folderId: string };
}

export function createDriveService(): DriveService {
  return {
    uploadImage(base64Data, folderId, options = {}) {
      try {
        const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          return { success: false, message: 'Invalid image data format' };
        }

        const imageType = matches[1];
        const base64Content = matches[2];
        const bytes = Utilities.base64Decode(base64Content);

        if (options.maxSizeBytes && bytes.length > options.maxSizeBytes) {
          const maxMB = Math.round(options.maxSizeBytes / (1024 * 1024));
          return { success: false, message: `Image exceeds ${maxMB}MB limit` };
        }

        const prefix = options.prefix ?? 'upload';
        const fileName = `${prefix}_${Date.now()}.${imageType}`;
        const blob = Utilities.newBlob(bytes)
          .setName(fileName)
          .setContentType(`image/${imageType}`);

        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(blob);

        return { success: true, fileId: file.getId() };
      } catch (e) {
        return { success: false, message: `Upload failed: ${e}` };
      }
    },

    getFileAsBase64(fileId: string): string | null {
      try {
        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        const base64 = Utilities.base64Encode(blob.getBytes());
        const mimeType = blob.getContentType();
        return `data:${mimeType};base64,${base64}`;
      } catch {
        return null;
      }
    },

    deleteFile(fileId: string): boolean {
      try {
        const file = DriveApp.getFileById(fileId);
        // Move to trash
        (file as unknown as { setTrashed(t: boolean): void }).setTrashed(true);
        return true;
      } catch {
        return false;
      }
    },

    createOrGetFolder(folderName = 'AppUploads'): { folderId: string } {
      const props = PropertiesService.getScriptProperties();
      const existing = props.getProperty('UPLOAD_FOLDER_ID');
      if (existing) {
        try {
          DriveApp.getFolderById(existing);
          return { folderId: existing };
        } catch {
          // Folder deleted — recreate
        }
      }

      const folder = DriveApp.createFolder(folderName);
      props.setProperty('UPLOAD_FOLDER_ID', folder.getId());
      return { folderId: folder.getId() };
    },
  };
}
