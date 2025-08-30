import { GoogleGenAI, Type } from "@google/genai";
import type { CharacterStats, Story } from '@/types';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });

const infoItemArraySchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      ten: { type: Type.STRING, description: "Tên của mục." },
      moTa: { type: Type.STRING, description: "Mô tả ngắn gọn về công dụng, nguồn gốc hoặc đặc điểm." },
      status: { type: Type.STRING, description: "Trạng thái: 'active' nếu còn, 'used' nếu dùng hết, 'lost' nếu mất." },
    },
    required: ["ten", "moTa"]
  }
};

const characterStatsSchema = {
  type: Type.OBJECT,
  properties: {
    trangThai: {
      type: Type.OBJECT,
      description: "Thông tin cơ bản và các đặc tính của nhân vật chính.",
      properties: {
        ten: { type: Type.STRING, description: "Tên nhân vật chính." },
        tuChat: {
          type: Type.ARRAY,
          description: "Danh sách các tư chất, huyết mạch, thể chất đặc biệt, hoặc các trạng thái/danh hiệu đặc biệt của nhân vật.",
          items: {
            type: Type.OBJECT,
            properties: {
              ten: { type: Type.STRING, description: "Tên của đặc tính (ví dụ: Thiên Đạo Trúc Cơ, Bất Tử Thân)." },
              moTa: { type: Type.STRING, description: "Mô tả ngắn gọn về đặc tính đó." }
            },
            required: ["ten", "moTa"]
          }
        }
      },
    },
    canhGioi: {
      type: Type.STRING,
      description: "Cảnh giới tu luyện hiện tại của nhân vật chính.",
    },
    heThongCanhGioi: {
        type: Type.ARRAY,
        description: "Danh sách các cảnh giới tu luyện theo thứ tự từ thấp đến cao được đề cập trong truyện (ví dụ: Luyện Khí, Trúc Cơ, Kim Đan...)",
        items: { type: Type.STRING }
    },
    balo: {
        ...infoItemArraySchema,
        description: "Danh sách các vật phẩm, đan dược, pháp bảo được đề cập trong chương này.",
    },
    congPhap: {
        ...infoItemArraySchema,
        description: "Danh sách các công pháp, kỹ năng, thần thông được đề cập trong chương này.",
    },
    trangBi: {
        ...infoItemArraySchema,
        description: "Danh sách các trang bị nhân vật đang mặc trên người được đề cập trong chương này.",
    },
    npcs: {
      type: Type.ARRAY,
      description: "Danh sách các nhân vật phụ (NPC) quan trọng xuất hiện hoặc được nhắc đến, cùng với mô tả và trạng thái của họ.",
      items: {
        type: Type.OBJECT,
        properties: {
          ten: { type: Type.STRING, description: "Tên của nhân vật phụ." },
          moTa: { type: Type.STRING, description: "Mô tả ngắn gọn về vai trò, phe phái, hoặc mối quan-hệ của họ với nhân vật chính." },
          status: { type: Type.STRING, description: "Trạng thái: 'active' nếu còn sống, 'dead' nếu đã chết." }
        },
        required: ["ten", "moTa"]
      }
    },
    theLuc: {
      type: Type.ARRAY,
      description: "Danh sách các môn phái, gia tộc, hoặc thế lực được đề cập trong chương.",
      items: {
        type: Type.OBJECT,
        properties: {
          ten: { type: Type.STRING, description: "Tên của môn phái hoặc thế lực." },
          moTa: { type: Type.STRING, description: "Mô tả ngắn gọn về thế lực này." },
          status: { type: Type.STRING, description: "Trạng thái: 'active' nếu tồn tại, 'destroyed' nếu bị phá hủy." }
        },
        required: ["ten", "moTa"]
      }
    },
    diaDiem: {
      type: Type.ARRAY,
      description: "Danh sách các địa danh, thành thị, bí cảnh xuất hiện trong chương này.",
      items: {
        type: Type.OBJECT,
        properties: {
          ten: { type: Type.STRING, description: "Tên của địa điểm." },
          moTa: { type: Type.STRING, description: "Mô tả ngắn gọn về địa điểm này." },
          status: { type: Type.STRING, description: "Trạng thái: 'active' nếu tồn tại, 'destroyed' nếu bị phá hủy." },
          capDo: { type: Type.STRING, description: "Cấp bậc của địa điểm (ví dụ: Giới Vực, Đại Vực, Châu Lục, Khu Vực)." },
          diaDiemCha: { type: Type.STRING, description: "Tên của địa điểm cha mà nó trực thuộc." },
        },
        required: ["ten", "moTa"]
      }
    },
    quanHe: {
      type: Type.ARRAY,
      description: "Danh sách các mối quan hệ giữa các nhân vật được đề cập trong chương. Chỉ bao gồm các mối quan-hệ được nêu rõ ràng.",
      items: {
        type: Type.OBJECT,
        properties: {
          nhanVat1: { type: Type.STRING, description: "Tên của nhân vật thứ nhất." },
          nhanVat2: { type: Type.STRING, description: "Tên của nhân vật thứ hai." },
          moTa: { type: Type.STRING, description: "Mô tả mối quan hệ (ví dụ: Đồng minh, Kẻ thù, Sư đồ, Gia tộc, Giao dịch...). Cố gắng ngắn gọn." }
        },
        required: ["nhanVat1", "nhanVat2", "moTa"]
      }
    },
    viTriHienTai: {
        type: Type.STRING,
        description: "Tên của địa điểm cụ thể và chi tiết nhất nơi nhân vật chính đang ở. Giá trị này PHẢI khớp với một trong các tên trong danh sách 'diaDiem'.",
    }
  },
};

/**
 * Phân tích nội dung chương truyện để trích xuất thông tin nhân vật chính.
 * @param chapterContent Nội dung văn bản của chương truyện.
 * @param previousStats Dữ liệu tích lũy từ các chương trước.
 * @returns Một đối tượng CharacterStats chứa thông tin được trích xuất.
 */
export const analyzeChapterForCharacterStats = async (chapterContent: string, previousStats: CharacterStats | null): Promise<CharacterStats | null> => {
    const contents = `Bạn là một trợ lý phân tích truyện tiên hiệp chuyên nghiệp, có khả năng duy trì và cập nhật trạng thái của thế giới truyện qua từng chương.

**DỮ LIỆU HIỆN TẠI:**
Dưới đây là thông tin đã biết về nhân vật và thế giới truyện cho đến trước chương này.
\`\`\`json
${JSON.stringify(previousStats ?? {}, null, 2)}
\`\`\`

**NHIỆM VỤ:**
Đọc nội dung **CHƯƠNG MỚI** và chỉ trích xuất những thông tin **MỚI** hoặc **THAY ĐỔI** so với "DỮ LIỆU HIỆN TẠI".

**QUY TẮC CẬP NHẬT (RẤT QUAN TRỌNG):**
1.  **CHỈ CẬP NHẬT:** Không lặp lại thông tin đã có. Nếu nhân vật đột phá, chỉ trả về \`canhGioi\` mới. Nếu có NPC mới, chỉ thêm NPC đó vào mảng \`npcs\`. Nếu một NPC đã có chết đi, cập nhật \`status\` của họ.
2.  **LIÊN KẾT DANH XƯNG VÀ TÊN THẬT:** Chú ý các trường hợp một nhân vật được giới thiệu bằng một danh xưng hoặc mô tả (ví dụ: 'lão già áo xám', 'thiếu nữ xinh đẹp') rồi sau đó mới tiết lộ tên thật. Hãy liên kết mô tả đó với tên thật và chỉ ghi nhận nhân vật bằng tên thật của họ. Ví dụ: Nếu truyện viết 'Một thanh niên gầy gò bước ra và nói: "Ta là Hứa Bảo Tài"', chỉ cần ghi nhận NPC tên là "Hứa Bảo Tài" và có thể thêm mô tả "thanh niên gầy gò" vào phần mô tả của NPC đó.
3.  **XÁC ĐỊNH NHÂN VẬT QUẦN CHÚNG:** Phân biệt rõ ràng giữa nhân vật phụ (NPC) có vai trò và nhân vật quần chúng (extras). KHÔNG đưa nhân vật quần chúng (ví dụ: lính gác, người qua đường, tiểu nhị không có vai trò) vào danh sách \`npcs\` hoặc \`quanHe\`.
4.  **LỌC QUAN HỆ CÓ Ý NGHĨA:** Chỉ đưa một mối quan hệ vào mảng \`quanHe\` nếu nó liên quan MẬT THIẾT đến nhân vật chính và được thể hiện rõ ràng trong chương. Các tương tác thoáng qua hoặc không có ý nghĩa quan hệ (ví dụ: một đường chủ họ Chu xuất hiện nhiều nhưng không có tương tác trực tiếp) thì KHÔNG đưa vào. Mối quan hệ phải thuộc một trong các cấp độ trong thang đo.
5.  **TRỌNG TÂM LÀ THAY ĐỔI:** Hệ thống sẽ tự động hợp nhất các thay đổi. Không cần trả lại toàn bộ danh sách cũ.
6.  **VỊ TRÍ HIỆN TẠI:** \`viTriHienTai\` phải khớp chính xác với một địa điểm trong \`diaDiem\` của chương này.

**THANG ĐO MÔ TẢ QUAN HỆ (RẤT QUAN TRỌNG):**
Khi mô tả một mối quan hệ trong trường \`moTa\`, hãy sử dụng các từ khóa sau để thể hiện chính xác sắc thái và mức độ của mối quan hệ đó. Đây là cơ sở để hệ thống hiển thị màu sắc tương ứng theo thứ tự từ cao đến thấp.

*   **Cấp 6: Thân Thiết Tột Cùng (Màu Xanh Lá)**
    *   **Mô tả:** Mối quan hệ gắn bó sâu sắc, cốt lõi, không thể phá vỡ, hoặc tình cảm cực kỳ thân thiết.
    *   **Từ khóa:** \`sư đồ\`, \`phu thê\`, \`tri kỷ\`, \`huynh đệ kết nghĩa\`, \`gia tộc thân cận\`, \`sống chết có nhau\`, \`trung thành tuyệt đối\`, \`ân nhân cứu mạng\`.
    *   *Ví dụ:* "Sư đồ truyền thừa", "Phu thê đồng lòng".

*   **Cấp 5: Đồng Minh / Tích Cực (Màu Xanh Ngọc)**
    *   **Mô tả:** Quan hệ tích cực, có thiện chí, tin tưởng lẫn nhau.
    *   **Từ khóa:** \`đồng minh\`, \`bằng hữu\`, \`đồng môn\`, \`thân hữu\`, \`giúp đỡ\`, \`cảm kích\`, \`tiền bối đáng kính\`.
    *   *Ví dụ:* "Đồng minh trong bí cảnh", "Bằng hữu cùng chiến tuyến".

*   **Cấp 4: Trung Lập (Màu Vàng)**
    *   **Mô tả:** Không thiên vị, hoặc quan hệ dựa trên lợi ích, giao dịch.
    *   **Từ khóa:** \`giao dịch\`, \`hợp tác tạm thời\`, \`quen biết sơ\`, \`người qua đường\`.
    *   *Ví dụ:* "Giao dịch mua bán vật phẩm", "Hợp tác tạm thời để vượt ải".

*   **Cấp 3: Mâu Thuẫn / Cạnh Tranh (Màu Cam)**
    *   **Mô tả:** Tiêu cực ở mức độ nhẹ, cạnh tranh, không ưa nhau nhưng chưa có ý định hãm hại nghiêm trọng.
    *   **Từ khóa:** \`đối thủ cạnh tranh\`, \`coi thường\`, \`chán ghét\`, \`xung đột lợi ích\`, \`gây sự\`.
    *   *Ví dụ:* "Đối thủ cạnh tranh trong môn phái", "Chán ghét vì tính cách kiêu ngạo".

*   **Cấp 2: Thù Địch (Màu Đỏ Hồng)**
    *   **Mô tả:** Đối đầu trực tiếp, có ý định hoặc hành động hãm hại, phản bội.
    *   **Từ khóa:** \`kẻ thù\`, \`đối địch\`, \`phản bội\`, \`hãm hại\`, \`âm mưu\`, \`ghen ghét\`.
    *   *Ví dụ:* "Kẻ thù đã phản bội nhân vật chính", "Âm mưu hãm hại để đoạt bảo vật".

*   **Cấp 1: Sinh Tử Đại Địch (Màu Đỏ Sẫm)**
    *   **Mô tả:** Mối thù không thể hóa giải, liên quan đến sinh tử, huyết thù.
    *   **Từ khóa:** \`huyết hải thâm thù\`, \`truy sát đến cùng\`, \`sinh tử đại địch\`, \`diệt tộc\`, \`thù không đội trời chung\`.
    *   *Ví dụ:* "Huyết hải thâm thù vì bị diệt cả gia tộc".

**QUY TẮC PHÂN BIỆT (CỰC KỲ QUAN TRỌNG):**
- **CAM (Mâu thuẫn):** Chỉ dùng cho sự cạnh tranh, không ưa nhau, xung đột nhỏ. **KHÔNG** có ý định gây hại nghiêm trọng.
- **ĐỎ HỒNG (Thù địch):** Dùng khi có ý định hoặc hành động hãm hại, phản bội. Mức độ thù ghét rõ ràng.
- **ĐỎ SẪM (Sinh tử):** **CHỈ** dùng cho mối thù sinh tử, không thể hóa giải.

**NỘI DUNG CHƯƠNG MỚI:**
"${chapterContent.substring(0, 15000)}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: characterStatsSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        return null;
    }

    const stats = JSON.parse(jsonText) as CharacterStats;
    
    // Lọc ra các mảng rỗng hoặc các đối tượng trạng thái rỗng
    const hasData = 
        (stats.canhGioi && stats.canhGioi.trim() !== "") ||
        (stats.viTriHienTai && stats.viTriHienTai.trim() !== "") ||
        (stats.heThongCanhGioi && stats.heThongCanhGioi.length > 0) ||
        (stats.balo && stats.balo.length > 0) ||
        (stats.congPhap && stats.congPhap.length > 0) ||
        (stats.trangBi && stats.trangBi.length > 0) ||
        (stats.trangThai && (!!stats.trangThai.ten || !!stats.trangThai.tuChat?.length)) ||
        (stats.npcs && stats.npcs.length > 0) ||
        (stats.theLuc && stats.theLuc.length > 0) ||
        (stats.diaDiem && stats.diaDiem.length > 0) ||
        (stats.quanHe && stats.quanHe.length > 0);


    return hasData ? stats : null;

  } catch (error)
 {
    console.error("Lỗi khi phân tích chỉ số nhân vật:", error);
    // Không ném lỗi ra ngoài để không làm gián đoạn trải nghiệm đọc
    return null;
  }
};