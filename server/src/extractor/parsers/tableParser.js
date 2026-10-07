/**
 * Generic Table Parser using coordinate geometry
 * Clusters text items into grid rows and columns based on header alignment.
 */

export function clusterTableCells(lines, columnXThresholds = []) {
  if (!lines || lines.length === 0) return [];

  const rows = [];
  for (const line of lines) {
    if (!line.items || line.items.length === 0) continue;

    // Sort items horizontally
    const sortedItems = [...line.items].sort((a, b) => a.x - b.x);

    // If explicit column thresholds provided, partition into slots
    if (columnXThresholds.length > 0) {
      const cellSlots = Array(columnXThresholds.length + 1).fill('').map(() => []);

      for (const item of sortedItems) {
        let colIdx = 0;
        for (let i = 0; i < columnXThresholds.length; i++) {
          if (item.x >= columnXThresholds[i]) {
            colIdx = i + 1;
          }
        }
        cellSlots[colIdx].push(item);
      }

      const rowCells = cellSlots.map(itemsInCell => ({
        text: itemsInCell.map(it => it.str).join(' ').trim(),
        items: itemsInCell,
        bbox: itemsInCell.length > 0 ? computeBoundingBox(itemsInCell) : null
      }));

      rows.push({
        y: line.y,
        cells: rowCells,
        rawText: line.text
      });
    } else {
      // Default grouping by whitespace spacing
      rows.push({
        y: line.y,
        cells: sortedItems.map(it => ({
          text: it.str.trim(),
          items: [it],
          bbox: it.bbox
        })),
        rawText: line.text
      });
    }
  }

  return rows;
}

function computeBoundingBox(items) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }
  return [
    Math.round(minX * 10) / 10,
    Math.round(minY * 10) / 10,
    Math.round((maxX - minX) * 10) / 10,
    Math.round((maxY - minY) * 10) / 10
  ];
}
