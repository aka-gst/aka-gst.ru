import Foundation
import Vision
import AppKit

// Печатает по строке на файл: <сколько лиц>\t<путь>\t<рамки>
// Не найдено — ноль. Не прочиталось — падаем с !!, а не «ноль лиц»
// (правило 7р: тихий пропуск запрещён).
let пути = Array(CommandLine.arguments.dropFirst())
if пути.isEmpty {
    FileHandle.standardError.write("!! не дано ни одного файла\n".data(using: .utf8)!)
    exit(2)
}
var сбой = false
for путь in пути {
    guard let img = NSImage(contentsOfFile: путь),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        FileHandle.standardError.write("!! не читается: \(путь)\n".data(using: .utf8)!)
        сбой = true
        continue
    }
    let запрос = VNDetectFaceRectanglesRequest()
    do {
        try VNImageRequestHandler(cgImage: cg, options: [:]).perform([запрос])
    } catch {
        FileHandle.standardError.write("!! сбой распознавания \(путь): \(error)\n".data(using: .utf8)!)
        сбой = true
        continue
    }
    let лица = запрос.results ?? []
    let рамки = лица.map { л in
        String(format: "%.2f,%.2f,%.2fx%.2f",
               л.boundingBox.origin.x, л.boundingBox.origin.y,
               л.boundingBox.size.width, л.boundingBox.size.height)
    }
    print("\(лица.count)\t\(путь)\t\(рамки.joined(separator: " "))")
}
exit(сбой ? 2 : 0)
