// Basic DOCX text extraction — reads ZIP, extracts word/document.xml, strips XML tags
// No external dependencies needed

export async function extractDocxText(arrayBuffer) {
  try {
    // DOCX is a ZIP file. We need to find word/document.xml
    const bytes = new Uint8Array(arrayBuffer);

    // Find the central directory
    let cdOffset = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        cdOffset = bytes[i + 16] | (bytes[i + 17] << 8) | (bytes[i + 18] << 16) | (bytes[i + 19] << 24);
        break;
      }
    }

    if (cdOffset < 0) throw new Error("Not a valid ZIP/DOCX file");

    // Parse central directory entries to find word/document.xml
    let pos = cdOffset;
    let documentXmlOffset = -1;
    let documentXmlCompressedSize = 0;
    let documentXmlUncompressedSize = 0;
    let compressionMethod = 0;

    while (pos < bytes.length - 46) {
      if (bytes[pos] !== 0x50 || bytes[pos + 1] !== 0x4b || bytes[pos + 2] !== 0x01 || bytes[pos + 3] !== 0x02) break;

      compressionMethod = bytes[pos + 10] | (bytes[pos + 11] << 8);
      const compressedSize = bytes[pos + 20] | (bytes[pos + 21] << 8) | (bytes[pos + 22] << 16) | (bytes[pos + 23] << 24);
      const uncompressedSize = bytes[pos + 24] | (bytes[pos + 25] << 8) | (bytes[pos + 26] << 16) | (bytes[pos + 27] << 24);
      const nameLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const extraLen = bytes[pos + 30] | (bytes[pos + 31] << 8);
      const commentLen = bytes[pos + 32] | (bytes[pos + 33] << 8);
      const localHeaderOffset = bytes[pos + 42] | (bytes[pos + 43] << 8) | (bytes[pos + 44] << 16) | (bytes[pos + 45] << 24);

      const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));

      if (name === "word/document.xml") {
        documentXmlOffset = localHeaderOffset;
        documentXmlCompressedSize = compressedSize;
        documentXmlUncompressedSize = uncompressedSize;
        break;
      }

      pos += 46 + nameLen + extraLen + commentLen;
    }

    if (documentXmlOffset < 0) throw new Error("word/document.xml not found in DOCX");

    // Read local file header to get to data
    const localNameLen = bytes[documentXmlOffset + 26] | (bytes[documentXmlOffset + 27] << 8);
    const localExtraLen = bytes[documentXmlOffset + 28] | (bytes[documentXmlOffset + 29] << 8);
    const dataStart = documentXmlOffset + 30 + localNameLen + localExtraLen;
    const localCompressionMethod = bytes[documentXmlOffset + 8] | (bytes[documentXmlOffset + 9] << 8);

    let xmlText;
    if (localCompressionMethod === 0) {
      // Stored (no compression)
      xmlText = new TextDecoder().decode(bytes.slice(dataStart, dataStart + documentXmlUncompressedSize));
    } else {
      // Deflated — use DecompressionStream
      const compressed = bytes.slice(dataStart, dataStart + documentXmlCompressedSize);
      const ds = new DecompressionStream("raw");
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      xmlText = new TextDecoder().decode(result);
    }

    // Extract text from XML — get content from <w:t> tags and add paragraph breaks
    let text = xmlText
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Decode XML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    return text;
  } catch (err) {
    console.error("[docx-extract]", err.message);
    // Fallback: try reading as plain text
    try {
      return new TextDecoder().decode(arrayBuffer);
    } catch {
      return "";
    }
  }
}
