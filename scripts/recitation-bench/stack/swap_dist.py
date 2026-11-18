# Swaps node_modules/@tilawa/core/dist for the engine stack's copy in one rename, so a
# bench process starting at that moment sees one or the other, never a mix of folders.
import ctypes, os, shutil, sys
root, src, keep = sys.argv[1:4]
core = os.path.join(root, 'node_modules/@tilawa/core')
new = os.path.join(core, 'dist.new')
if os.path.exists(new):
    raise SystemExit('dist.new is already there')
shutil.copytree(src, new)
libc = ctypes.CDLL(None, use_errno=True)
RENAME_SWAP = 0x00000002
rc = libc.renamex_np(new.encode(), os.path.join(core, 'dist').encode(), RENAME_SWAP)
if rc != 0:
    raise SystemExit(f'swap failed: {os.strerror(ctypes.get_errno())}')
# dist.new now holds the old folder: keep it out of node_modules.
shutil.rmtree(keep, ignore_errors=True)
shutil.move(new, keep)
print('swapped; old dist kept at', keep)
