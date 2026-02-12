import struct, zlib

width, height = 100, 100

def png_chunk(chunk_type, data):
    chunk_len = struct.pack('>I', len(data))
    chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
    return chunk_len + chunk_type + data + chunk_crc

png_header = b'\x89PNG\r\n\x1a\n'
ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
ihdr = png_chunk(b'IHDR', ihdr_data)

raw_data = b''
for y in range(height):
    raw_data += b'\x00'
    for x in range(width):
        raw_data += b'\xff\x00\x00'

compressed = zlib.compress(raw_data)
idat = png_chunk(b'IDAT', compressed)
iend = png_chunk(b'IEND', b'')

with open('ta_sample.png', 'wb') as f:
    f.write(png_header + ihdr + idat + iend)

print(f'Created {width}x{height} PNG')
