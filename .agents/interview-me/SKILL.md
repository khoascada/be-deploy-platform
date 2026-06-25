---
name: interview-me
description: Khai thác điều người dùng thật sự muốn thay vì điều họ nghĩ là họ nên muốn. Làm việc này bằng cách hỏi từng câu một cho tới khi đạt khoảng 95% độ tự tin về intent gốc. Dùng khi yêu cầu còn thiếu chi tiết, khi người dùng gọi đích danh skill này, hoặc khi bạn nhận ra mình đang tự điền các phần mơ hồ trước khi có plan, spec hoặc code.
---

# Phỏng Vấn Tôi

## Tổng Quan

Điều con người yêu cầu và điều họ thật sự muốn thường không giống nhau. Họ nói "làm dashboard cho tôi" vì đó là cách gọi quen thuộc, không có nghĩa dashboard là đúng bài toán. Họ nói "làm nhanh hơn" nhưng không đưa ra con số đích.

Thời điểm rẻ nhất để phát hiện sự lệch này là trước khi có plan, spec hay code. Một khi đã bắt đầu build, chi phí đổi hướng là có thật, và người dùng sẽ dễ hợp lý hóa một giải pháp sai thành "thế này cũng được". Sự lệch đó sẽ bị khóa cứng vào sản phẩm.

Skill này đóng khoảng cách đó trước khi nó trở nên đắt đỏ. Những skill Define khác mặc định rằng bạn đã tương đối biết mình muốn gì: `idea-refine` giúp tạo và lọc biến thể từ một ý tưởng, `spec-driven-development` viết nó thành requirement, `doubt-driven-development` stress-test một quyết định sau khi nó đã được định hình. `interview-me` đứng ở trước tất cả những thứ đó: hỏi từng câu một, luôn đính kèm giả thuyết tốt nhất của bạn, cho đến khi bạn có thể dự đoán phản ứng của người dùng trước cả khi họ nói ra.

## Khi Nào Dùng

Áp dụng skill này khi:

- Yêu cầu đang thiếu ít nhất một trong các phần: **ai** là người hưởng lợi, **vì sao** họ muốn nó, **thành công** được đo thế nào, hoặc **ràng buộc** thực sự là gì
- Request nghe rất chung chung theo "văn mẫu" như "build cho tôi X", "làm nhanh hơn", và bạn không thể bóc tách nếu không tự đoán
- Bạn nhận ra mình đang muốn bắt đầu bằng những assumption chưa hề được nêu ra
- Người dùng chưa nói rõ họ đang tối ưu cho giá trị nào khi có hai giá trị hợp lý đang căng nhau như đơn giản vs linh hoạt, chi phí vs tốc độ
- Người dùng gọi đích danh kiểu: "interview me", "grill me", "are we sure?", "stress-test my thinking"

**Không dùng khi:**

- Yêu cầu đã rõ ràng, tự thân đầy đủ như "đổi tên biến này", "sửa typo này"
- Người dùng đã nói rõ họ ưu tiên tốc độ hơn verification
- Câu hỏi thuần thông tin như "X hoạt động thế nào?" hoặc "đoạn code này làm gì?"
- Tác vụ cơ học như rename, format, move file
- Bạn đã có >=95% độ tự tin; hãy đọc lại điều kiện dừng bên dưới trước khi tự nghĩ là mình chưa đủ chắc

## Ràng Buộc Khi Nạp Skill

Skill này cần người dùng đang tương tác trực tiếp. **Không dùng trong ngữ cảnh không tương tác** như CI pipeline, scheduled run, `/loop`, hay autonomous-loop. Nếu rơi vào trường hợp đó mà yêu cầu lại còn mơ hồ, hãy báo đây là blocker thay vì đoán.

## Quy Trình

### Bước 1: Viết ra giả thuyết, kèm con số độ tin

Trước khi hỏi gì, hãy viết ra cách hiểu tốt nhất của bạn về điều người dùng muốn trong **một câu**, kèm một con số độ tự tin thật lòng từ 0-100%:

```
HYPOTHESIS: Bạn muốn một cách trả lời câu "chúng ta đang tiến triển ra sao?" trong buổi standup, và "dashboard" chỉ là từ đầu tiên xuất hiện trong đầu.
CONFIDENCE: ~30% - còn thiếu: nó dành cho ai, "metrics" nghĩa là gì trong ngữ cảnh này, và thành công được định nghĩa ra sao
```

Con số buộc bạn phải thành thật. Nếu bạn ghi mức tự tin cao nhưng lại không đoán được người dùng sẽ phản ứng thế nào với ba câu hỏi tiếp theo, thì con số đó là sai. Hãy bắt đầu ở mức bạn thật sự bảo vệ được.

Khi độ tin dưới khoảng 70%, phải viết thêm ngắn gọn lý do ngay trên cùng dòng: còn thiếu điều gì, hoặc chỗ nào chưa ngã ngũ. Như vậy người dùng mới biết cần giúp bạn lấp khoảng trống nào.

### Bước 2: Hỏi từng câu một, mỗi câu phải có giả thuyết đi kèm

Format:

```
Q: <một câu hỏi tập trung>
GUESS: <giả thuyết của bạn về câu trả lời, kèm lý do>
```

Đợi người dùng phản hồi rồi mới hỏi câu tiếp theo.

**Vì sao chỉ hỏi từng câu một, không hỏi hàng loạt:**

- Người dùng không phản ứng được với giả thuyết của bạn nếu chúng bị vùi trong một danh sách dài
- Hỏi theo batch khiến họ dễ skim và trả lời hời hợt
- Câu hỏi thứ ba thường phụ thuộc vào câu trả lời thứ nhất; hỏi hết cùng lúc khóa cứng khung suy nghĩ sai
- Năng lượng suy nghĩ cẩn thận của người dùng là hữu hạn; hãy dùng nó từng chút một

**Vì sao phải đính kèm GUESS:**

- Người dùng phản ứng với một guess sai thường nhanh hơn tự nghĩ câu trả lời từ đầu
- Nó buộc bạn commit vào một giả thuyết có thể bị chứng minh là sai, giúp bạn trung thực hơn
- Nó lôi assumptions của chính bạn ra ngoài, đúng mục đích của cuộc phỏng vấn này

Rủi ro ở đây là người dùng lịch sự quá mức và gật đầu theo guess của bạn. Hãy giảm rủi ro đó bằng cách cho thấy bạn rất sẵn sàng bị sửa và đôi lúc đoán theo hướng mà bạn dự đoán họ sẽ phản biện lại.

### Bước 3: Lắng nghe dấu hiệu "muốn thật" vs "nghĩ là nên muốn"

Những câu trả lời nguy hiểm nhất là khi người dùng nói điều nghe có vẻ chuẩn mực thay vì điều họ thật sự muốn. Dấu hiệu cần chú ý:

- Câu trả lời nói theo kiểu best-practice như "em muốn scalable", "kiến trúc sạch" nhưng không có chi tiết
- Câu trả lời dựa vào quy ước như "làm kiểu app thường làm", "cách chuẩn"
- Các cụm như "chắc em nên...", "em nghĩ là phải...", "good engineering practice nói rằng..."
- Buzzword đứng một mình như "modern", "robust", "scalable" mà không gắn với outcome cụ thể

Khi gặp tín hiệu này, câu nên hỏi là:

> *"Nếu không cần phải biện minh với ai cả, thì điều bạn thật sự muốn là gì?"*

Chỉ một câu đó thường hiệu quả hơn năm câu trước cộng lại.

### Bước 4: Restate intent bằng chính ngôn ngữ của người dùng

Khi độ tin đủ cao, hãy viết lại điều bạn tin là người dùng muốn. Giữ ngắn gọn khoảng 5-8 dòng, dùng ngôn ngữ của họ khi có thể, và cấu trúc sao cho họ có thể xác nhận từng dòng:

```
Đây là điều mình nghĩ bạn thật sự muốn:

- Outcome:      <một dòng>
- User:         <một dòng - ai hưởng lợi>
- Why now:      <một dòng - điều gì khiến việc này cần làm bây giờ>
- Success:      <một dòng - làm sao biết là thành công>
- Constraint:   <một dòng - ràng buộc cứng>
- Out of scope: <một dòng - điều gì chắc chắn không làm>

Đúng / sai / cần chỉnh chỗ nào?
```

Dòng "Out of scope" là bắt buộc. Một nửa số lần lệch nhau đến từ việc hai bên không đồng ý ngầm về những gì **không** được làm.

### Bước 5: Xác nhận bằng chữ "yes" thật sự, không phải "tùy bạn"

Cổng qua bước này là một câu **yes** rõ ràng. Những câu sau **không được tính là yes**:

- "Whatever you think is best." -> Người dùng đang ủy quyền, tức là họ cũng chưa đủ chắc. Hãy hỏi lại bằng hai lựa chọn cụ thể.
- "Sounds good." -> Còn mơ hồ. Hãy hỏi tiếp: "Có chỗ nào cần chỉnh không?"
- "Sure, let's go." -> Thường chỉ là cách thoát cuộc phỏng vấn. Cũng cần hỏi tiếp như trên.
- Im lặng rồi chuyển sang "ok bắt đầu thôi." -> Người dùng đã mệt với interview chứ chưa chắc đã đồng ý. Hãy dừng lại và hỏi xem bạn có bỏ sót gì không.

Nếu họ sửa bạn, hãy cập nhật restate rồi lặp tiếp cho tới khi có một câu yes rõ ràng.

### Điều Kiện Dừng 95%

Bạn chỉ được dừng khi trả lời "có" cho câu này:

> *"Mình có dự đoán được phản ứng của người dùng với ba câu hỏi tiếp theo mà mình định hỏi không?"*

Nếu có, nghĩa là bạn đã có shared understanding. Hãy dừng phỏng vấn và xuất phần restate. Nếu không, bạn chưa xong; hãy hỏi câu tiếp theo.

Đây là một tiêu chuẩn có thể kiểm tra được, không phải cảm giác. Nó cũng có một điểm sàn: nếu đã hỏi nhiều vòng mà vẫn không đoán nổi, đó là tín hiệu về chính yêu cầu chứ không phải lý do để tiếp tục hỏi vô tận. Hãy nói thẳng: "Mình đã hỏi X câu mà vẫn chưa dự đoán được phản ứng của bạn. Có vẻ đang thiếu một thứ nền tảng nào đó. Mình lùi lại một bước nhé?"

## Output

Output của skill này là một **statement of intent đã được xác nhận**: phần restate ở Bước 4, đi kèm một câu yes rõ ràng ở Bước 5. Đó mới là deliverable. Spec, plan và task list là bước sau; chúng chỉ tiêu thụ intent đã được chốt.

Nếu người dùng muốn intent này được lưu lại cho các phiên sau hoặc để handoff, hãy đề nghị lưu vào `docs/intent/[topic].md`. Chỉ lưu nếu họ đồng ý.

## Ví Dụ

Một ví dụ ngắn trước và sau.

**Nếu không dùng `interview-me`:**

```
User:  build me a dashboard for our metrics
Agent: <bắt đầu đề xuất chart library và layout>
```

Agent đã tự giả định: dashboard cho ai, "metrics" là gì, "our team" nghĩa là ai, success là gì. Không điều nào được nói ra. Mỗi assumption là một điểm mà sau này user có thể bảo "đó không phải thứ tôi muốn".

**Nếu có dùng `interview-me`:**

```
User: build me a dashboard for our metrics

Agent:
HYPOTHESIS: Bạn muốn một cách trả lời câu "chúng ta đang tiến triển ra sao?" trong standup, và "dashboard" là câu trả lời quen thuộc bật ra đầu tiên.
CONFIDENCE: ~30% - còn thiếu: dành cho ai, "metrics" là gì, và thành công nghĩa là gì

Q:     Khi bạn nói "chúng ta đang tiến triển ra sao?", ai là người đang hỏi - riêng bạn, team kỹ thuật trong standup, hay phía quản lý / exec?
GUESS: team kỹ thuật trong standup, vì từ "we" thường ám chỉ vậy và đây là nơi câu hỏi đó xuất hiện nhiều nhất. Nếu là cho exec thì bộ metrics và cách trình bày sẽ khác hẳn.

User: Thực ra là cho riêng mình. Mình cứ bị mất dấu xem đang có những experiment nào và tín hiệu ban đầu của chúng ra sao.

Agent:
Hiểu mới: đây không phải dashboard cho team mà là công cụ cá nhân để theo dõi experiment. Confidence: ~60% - vẫn thiếu: "tín hiệu ban đầu" nghĩa là gì và done trông ra sao.

Q:     Vấn đề là bạn không biết có những experiment nào tồn tại, hay là bạn không xem được kết quả của chúng ở một chỗ?
GUESS: là vế thứ hai. Có danh sách ở đâu đó rồi nhưng kết quả nằm rải ở nhiều tool, việc ghép chúng bằng tay mới là cái bạn mệt.

User: Thực ra là vế thứ nhất. Mình còn chưa có nổi một danh sách. Chúng nằm rải trong nhiều docs.

Agent: <tiếp tục>
```

Chỉ sau hai câu hỏi, agent đã phát hiện rằng yêu cầu thật không phải "dashboard" mà là "một danh sách". Artifact khác, scope khác, công việc khác. Làm dashboard lúc đầu sẽ là sai bài toán.

## Tương Tác Với Skill Khác

- **`idea-refine`**: đi sau. Nếu intent đã được chốt là "mình muốn X nhưng chưa biết nên scope ra sao", hãy chuyển sang `idea-refine` để tạo biến thể dựa trên intent đó.
- **`spec-driven-development`**: đi sau. Nếu intent đã đủ cụ thể, như "mình muốn X cho nhóm Y với success criteria Z", hãy chuyển sang viết spec.
- **`planning-and-task-breakdown`**: đi sau hai bước so với skill này, tức là sau khi đã có spec.
- **`doubt-driven-development`**: ở phía đối diện của timeline. `interview-me` để bóc tách intent trước khi quyết định; `doubt-driven-development` để soi lại artifact sau khi quyết định đã hình thành.
- **`source-driven-development`**: trực giao. `interview-me` làm rõ người dùng muốn gì; source-driven dùng để xác minh sự thật về framework.

## Các Lý Do Tự Hợp Lý Hóa Thường Gặp

| Lý do | Sự thật |
|---|---|
| "Yêu cầu cũng đủ rõ rồi" | Nếu ngay lúc này bạn không thể viết ra outcome mong muốn của user trong một câu, thì yêu cầu chưa rõ. |
| "Hỏi nhiều quá tốn thời gian của họ" | 4-6 câu hỏi trúng đích rẻ hơn rất nhiều so với build nhầm thứ. |
| "Cứ build rồi sẽ hiểu dần" | Khi đã có code, chi phí đổi hướng cao gấp nhiều lần. |
| "Họ bảo tùy mình quyết" | Đó là ủy quyền, không phải quyết định. Hãy hỏi lại với hai option cụ thể. |
| "Cho họ nhiều lựa chọn luôn sẽ hay hơn" | Option chỉ hữu ích khi user đã biết họ muốn gì và đang so tradeoff. Ở giai đoạn này cần thu hẹp, không phải mở rộng. |
| "Gắn guess vào sẽ dẫn dắt họ" | Dẫn dắt là chủ đích. Cái nguy hiểm là sự đồng ý cho có; khắc phục bằng cách sẵn sàng bị sửa. |
| "Nói chuyện đủ rồi, mình hiểu mà" | Hãy tự test: bạn đoán được phản ứng của họ với ba câu hỏi tiếp theo không? Nếu không thì chưa hiểu. |
| "Họ nói yes rồi, xong thôi" | Nếu cái yes đó dựa trên restate mơ hồ, thì chưa có giá trị. Hãy restate lại rõ rồi xác nhận lại. |

## Red Flags

- Hỏi ba câu hoặc hơn trong một message: đó là khảo sát hàng loạt, không phải phỏng vấn
- Có câu hỏi nhưng không có guess đi kèm
- Chấp nhận "whatever you think is best" như câu trả lời cuối
- Viết spec, plan hoặc task list trước khi user xác nhận restate
- Hỏi theo kiểu "best practice là gì?" thay vì "bạn thật sự muốn gì?"
- Người dùng trả lời bằng buzzword như "scalable", "clean", "modern" mà bạn không đào thêm
- Ba vòng trở lên mà confidence không tăng lên thấy rõ: bạn đang hỏi sai câu hỏi
- Ghi confidence dưới 70% nhưng không nói rõ còn thiếu gì
- Lưu intent doc trước khi user thật sự xác nhận
- Bỏ dòng "Out of scope" trong restate

## Verification

Sau khi dùng `interview-me`, xác nhận:

- [ ] Đã nêu giả thuyết và mức confidence ngay ở lượt đầu
- [ ] Mọi mức confidence dưới ~70% đều có lý do kèm theo
- [ ] Các câu hỏi được hỏi từng câu một, mỗi câu có guess đi kèm
- [ ] Đã ít nhất một lần đào sâu kiểu "nếu không phải biện minh với ai thì bạn thật sự muốn gì?" khi người dùng trả lời theo kiểu tín hiệu sophistication hoặc convention
- [ ] Đã viết restate rõ ràng theo Outcome / User / Why now / Success / Constraint / Out of scope
- [ ] Người dùng đã xác nhận restate bằng một câu yes rõ ràng
- [ ] Tại thời điểm dừng, agent có thể dự đoán phản ứng với ba câu hỏi tiếp theo
- [ ] Mọi handoff sang skill sau đều dựa trên intent đã được xác nhận, không dựa trên request mơ hồ ban đầu
