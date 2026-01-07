/**
 * Simple test file to verify download functionality
 * This file can be used to test the download system before UI integration
 */

import {DownloadManager} from './DownloadManager';
import {OfflineStorageManager} from './OfflineStorageManager';
import {Track} from '@/types/audio';

// Mock track for testing
const testTrack: Track = {
  id: 'test-track-1',
  url: 'https://server8.mp3quran.net/afs/001.mp3', // Al-Fatihah by Abu Bakr Al-Shatri
  title: 'Al-Fatihah',
  artist: 'Abu Bakr Al-Shatri',
  artwork: '',
  reciterId: 'afs',
  reciterName: 'Abu Bakr Al-Shatri',
  surahId: '1',
  rewayatId: 'hafs',
};

export async function testDownloadSystem() {
  try {
    console.log('🚀 Testing Download System...');

    // Initialize managers
    const downloadManager = DownloadManager.getInstance();
    const storageManager = OfflineStorageManager.getInstance();

    // Set up event listeners
    downloadManager.on('download_started', data => {
      console.log('📥 Download started:', data.trackId);
    });

    downloadManager.on('download_progress', data => {
      console.log(
        `📊 Download progress: ${data.progress.toFixed(1)}% (${data.downloadedBytes}/${data.totalBytes} bytes)`,
      );
    });

    downloadManager.on('download_completed', data => {
      console.log('✅ Download completed:', data.trackId, 'at', data.localPath);
    });

    downloadManager.on('download_failed', data => {
      console.log('❌ Download failed:', data.trackId, 'Error:', data.error);
    });

    // Initialize the system
    await downloadManager.initialize();
    console.log('✅ Download system initialized');

    // Check initial storage info
    const initialStorageInfo = await storageManager.getStorageInfo();
    console.log('💾 Initial storage info:', initialStorageInfo);

    // Test if track is already downloaded
    const isAlreadyDownloaded = await downloadManager.isTrackDownloaded(
      testTrack.id,
    );
    console.log('🔍 Track already downloaded:', isAlreadyDownloaded);

    if (isAlreadyDownloaded) {
      const localPath = await downloadManager.getLocalPath(testTrack.id);
      console.log('📁 Local path:', localPath);
      return;
    }

    // Add track to download queue
    console.log('📋 Adding track to download queue...');
    await downloadManager.addToDownloadQueue([testTrack], {
      wifiOnly: false, // Allow download on any connection for testing
      quality: '192',
      overwrite: false,
    });

    // Wait a bit and check storage info again
    setTimeout(async () => {
      try {
        const finalStorageInfo = await storageManager.getStorageInfo();
        console.log('💾 Final storage info:', finalStorageInfo);

        const downloads = await downloadManager.getAllDownloads();
        console.log('📦 All downloads:', downloads.length, 'items');

        downloads.forEach(download => {
          console.log(
            `  - ${download.track.title}: ${download.status} (${download.progress}%)`,
          );
        });
      } catch (error) {
        console.error('Error in final check:', error);
      }
    }, 10000); // Check after 10 seconds
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

export async function testStorageOperations() {
  try {
    console.log('🧪 Testing Storage Operations...');

    const storageManager = OfflineStorageManager.getInstance();
    await storageManager.initialize();

    // Test metadata operations
    const metadata = await storageManager.getDownloadMetadata();
    console.log('📄 Metadata loaded:', {
      version: metadata.version,
      downloadsCount: Object.keys(metadata.downloads).length,
      settings: metadata.settings,
    });

    // Test settings update
    await storageManager.updateSettings({
      maxConcurrentDownloads: 2,
      downloadQuality: '320',
    });
    console.log('⚙️ Settings updated');

    const updatedMetadata = await storageManager.getDownloadMetadata();
    console.log('📄 Updated settings:', updatedMetadata.settings);
  } catch (error) {
    console.error('❌ Storage test failed:', error);
  }
}

// Export for use in the app
export const downloadTestSuite = {
  testDownloadSystem,
  testStorageOperations,
};
