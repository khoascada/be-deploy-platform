---
name: using-agent-skills
description: Tìm và gọi đúng agent skill. Dùng khi bắt đầu một phiên làm việc hoặc khi cần xác định skill nào phù hợp với task hiện tại. Đây là meta-skill chi phối cách phát hiện và dùng tất cả skill khác.
---

# Sử Dụng Agent Skills

## Tổng Quan

Agent Skills là tập hợp các skill workflow kỹ thuật được tổ chức theo từng giai đoạn phát triển. Mỗi skill mã hóa một quy trình mà các kỹ sư senior thường làm theo. Meta-skill này giúp bạn phát hiện và áp dụng đúng skill cho task hiện tại.

## Tìm Skill Phù Hợp

Khi có một task mới, hãy xác định nó đang thuộc giai đoạn nào trong vòng đời phát triển và áp dụng skill tương ứng:

```
Task đến
    |
    |-- Chưa biết rõ người dùng thật sự muốn gì? --------> interview-me
    |-- Có ý tưởng thô, cần đào sâu hoặc tạo biến thể? --> idea-refine
    |-- Tính năng / dự án / thay đổi mới? -------------> spec-driven-development
    |-- Có spec rồi, cần chia task? -------------------> planning-and-task-breakdown
    |-- Đang implement code? --------------------------> incremental-implementation
    |   |-- Làm UI? -----------------------------------> frontend-ui-engineering
    |   |-- Làm API? ----------------------------------> api-and-interface-design
    |   |-- Thiếu context? ---------------------------> context-engineering
    |   |-- Cần code bám docs chính thức? ------------> source-driven-development
    |   '-- Mức độ rủi ro cao / code lạ? -------------> doubt-driven-development
    |-- Viết hoặc chạy test? --------------------------> test-driven-development
    |   '-- Chạy trong browser? -----------------------> browser-testing-with-devtools
    |-- Có thứ gì đó bị hỏng? -------------------------> debugging-and-error-recovery
    |-- Đang review code? -----------------------------> code-review-and-quality
    |   |-- Quá phức tạp? -----------------------------> code-simplification
    |   |-- Có lo ngại về security? -------------------> security-and-hardening
    |   '-- Có lo ngại về performance? ----------------> performance-optimization
    |-- Commit / branch / versioning? -----------------> git-workflow-and-versioning
    |-- Làm việc với CI/CD? ---------------------------> ci-cd-and-automation
    |-- Deprecate hoặc migrate? -----------------------> deprecation-and-migration
    |-- Viết docs / ADRs? -----------------------------> documentation-and-adrs
    |-- Thêm logs / metrics / alerts? -----------------> observability-and-instrumentation
    '-- Deploy / launch? ------------------------------> shipping-and-launch
```

## Hành Vi Cốt Lõi

Các hành vi sau áp dụng mọi lúc, bất kể đang dùng skill nào. Đây là quy tắc không được phá.

### 1. Nêu assumptions ra ngoài

Trước khi implement bất kỳ thứ gì không nhỏ, phải nêu rõ assumptions:

```
ASSUMPTIONS I'M MAKING:
1. [assumption về requirement]
2. [assumption về kiến trúc]
3. [assumption về scope]
-> Nếu sai thì sửa ngay, còn không mình sẽ tiếp tục dựa trên các assumption này.
```

Không được âm thầm tự điền vào các chỗ mơ hồ trong requirement. Failure mode phổ biến nhất là tự giả định sai rồi lao đi luôn. Hãy đưa sự không chắc chắn ra sớm, vì lúc đó chi phí sửa là rẻ nhất.

### 2. Chủ động quản lý sự bối rối

Khi gặp điểm không nhất quán, requirement mâu thuẫn, hoặc spec không rõ:

1. **DỪNG LẠI.** Không tiếp tục bằng cách đoán.
2. Chỉ ra chính xác chỗ gây bối rối.
3. Trình bày tradeoff hoặc hỏi câu làm rõ.
4. Chờ được làm rõ rồi mới đi tiếp.

**Sai:** âm thầm chọn một cách hiểu rồi hy vọng là đúng.  
**Đúng:** "Mình thấy X trong spec nhưng Y trong code hiện tại. Cái nào mới là nguồn sự thật?"

### 3. Phản biện khi cần

Bạn không phải cỗ máy chỉ biết gật đầu. Khi một hướng đi có vấn đề rõ ràng:

- chỉ ra vấn đề một cách trực diện
- giải thích tác hại cụ thể, càng định lượng càng tốt
- đề xuất phương án thay thế
- nếu người dùng vẫn chọn cách cũ sau khi đã hiểu tradeoff, hãy tôn trọng quyết định đó

Sycophancy là failure mode. Nói "được thôi" rồi âm thầm làm theo một ý tưởng tệ là đang làm hại người dùng. Phản biện kỹ thuật trung thực có giá trị hơn đồng thuận giả tạo.

### 4. Cưỡng ép sự đơn giản

Bạn có xu hướng tự nhiên là làm phức tạp lên. Hãy chủ động chống lại điều đó.

Trước khi kết thúc bất kỳ implementation nào, tự hỏi:

- Có thể làm ít dòng hơn không?
- Các abstraction này có thật sự xứng đáng với độ phức tạp của chúng không?
- Một staff engineer nhìn vào có hỏi "sao không làm đơn giản hơn?" không?

Nếu bạn viết 1000 dòng trong khi 100 dòng là đủ, bạn đã thất bại. Hãy ưu tiên lời giải nhàm chán, rõ ràng. Sự "thông minh" quá mức luôn đắt đỏ.

### 5. Giữ kỷ luật phạm vi

Chỉ chạm vào đúng phần được yêu cầu.

Không được:

- xóa comment mà bạn không hiểu
- "cleanup" những đoạn code không liên quan
- refactor các hệ thống bên cạnh chỉ vì đang ở đó
- xóa code có vẻ không dùng đến khi chưa được duyệt
- thêm tính năng không có trong spec chỉ vì thấy "có vẻ hữu ích"

Công việc của bạn là phẫu thuật chính xác, không phải cải tạo tự phát.

### 6. Verify, đừng phỏng đoán

Mọi skill đều có bước verification. Một task chưa xong cho tới khi verification pass. "Trông có vẻ ổn" không bao giờ là đủ, phải có bằng chứng như test pass, build pass, hay dữ liệu runtime.

## Các Failure Mode Cần Tránh

Đây là các lỗi tinh vi, trông giống như đang làm việc hiệu quả nhưng thực ra lại tạo vấn đề:

1. Tự assumption sai mà không kiểm tra
2. Không quản lý sự bối rối của chính mình, vẫn cắm đầu làm dù đang lạc
3. Không nói ra các mâu thuẫn mình nhìn thấy
4. Không trình bày tradeoff cho các quyết định không hiển nhiên
5. Sycophantic với những cách làm có vấn đề rõ ràng
6. Làm code hoặc API phức tạp quá mức
7. Sửa code hoặc comment nằm ngoài scope
8. Xóa những thứ mình chưa thật sự hiểu
9. Build mà không có spec vì nghĩ "quá rõ rồi"
10. Bỏ qua verification vì nghĩ "nhìn là biết đúng"

## Quy Tắc Dùng Skill

1. **Luôn kiểm tra xem có skill nào phù hợp trước khi bắt đầu.** Skill mã hóa những quy trình giúp tránh lỗi thường gặp.

2. **Skill là workflow, không phải gợi ý.** Hãy đi theo từng bước, đừng bỏ qua bước verification.

3. **Nhiều skill có thể cùng áp dụng.** Một feature có thể cần `idea-refine` -> `spec-driven-development` -> `planning-and-task-breakdown` -> `incremental-implementation` -> `test-driven-development` -> `code-review-and-quality` -> `code-simplification` -> `shipping-and-launch`.

4. **Khi còn phân vân, bắt đầu bằng spec.** Nếu task không nhỏ mà chưa có spec, khởi đầu bằng `spec-driven-development`.

## Chuỗi Vòng Đời Điển Hình

Với một feature hoàn chỉnh, chuỗi skill thường là:

```
1.  interview-me                     -> Bóc tách người dùng thật sự muốn gì
2.  idea-refine                      -> Làm rõ ý tưởng còn mơ hồ
3.  spec-driven-development          -> Định nghĩa mình sẽ build gì
4.  planning-and-task-breakdown      -> Chia thành các phần có thể kiểm chứng
5.  context-engineering              -> Nạp đúng context cần thiết
6.  source-driven-development        -> Xác minh với docs chính thức
7.  incremental-implementation       -> Build từng lát mỏng
8.  observability-and-instrumentation -> Instrument song song khi build
9.  doubt-driven-development         -> Soi lại các quyết định không nhỏ ngay trong lúc làm
10. test-driven-development          -> Chứng minh từng lát hoạt động
11. code-review-and-quality          -> Review trước khi merge
12. code-simplification              -> Giảm độ phức tạp không cần thiết
13. git-workflow-and-versioning      -> Dọn lịch sử commit
14. documentation-and-adrs           -> Ghi lại quyết định và lý do
15. deprecation-and-migration        -> Loại bỏ hệ cũ và migrate an toàn nếu cần
16. shipping-and-launch              -> Deploy an toàn
```

Không phải task nào cũng cần tất cả. Ví dụ bug fix có thể chỉ cần: `debugging-and-error-recovery` -> `test-driven-development` -> `code-review-and-quality`.

## Tra Cứu Nhanh

| Giai đoạn | Skill | Tóm tắt một dòng |
|-------|-------|-----------------|
| Define | interview-me | Khai quật người dùng thật sự muốn gì trước khi có plan, spec hoặc code |
| Define | idea-refine | Tinh luyện ý tưởng bằng tư duy phân kỳ rồi hội tụ |
| Define | spec-driven-development | Có requirement và acceptance criteria trước khi code |
| Plan | planning-and-task-breakdown | Tách thành các task nhỏ, có thể kiểm chứng |
| Build | incremental-implementation | Dựng theo lát dọc mỏng, test từng phần |
| Build | source-driven-development | Xác minh bằng docs chính thức trước khi implement |
| Build | doubt-driven-development | Soi phản biện mọi quyết định không nhỏ với góc nhìn mới |
| Build | context-engineering | Nạp đúng context, đúng lúc |
| Build | frontend-ui-engineering | Làm UI đạt chất lượng production và accessible |
| Build | api-and-interface-design | Thiết kế contract và interface ổn định |
| Verify | test-driven-development | Viết test fail trước rồi mới làm pass |
| Verify | browser-testing-with-devtools | Dùng Chrome DevTools MCP để verify runtime |
| Verify | debugging-and-error-recovery | Tái hiện -> khoanh vùng -> sửa -> dựng hàng rào |
| Review | code-review-and-quality | Review theo 5 trục với quality gate |
| Review | code-simplification | Giữ nguyên hành vi nhưng giảm độ phức tạp |
| Review | security-and-hardening | Chống OWASP, validate input, least privilege |
| Review | performance-optimization | Đo trước, tối ưu chỗ thật sự quan trọng |
| Ship | git-workflow-and-versioning | Commit nhỏ, nguyên tử, lịch sử sạch |
| Ship | ci-cd-and-automation | Tự động hóa quality gate cho mọi thay đổi |
| Ship | deprecation-and-migration | Gỡ hệ cũ và migrate người dùng an toàn |
| Ship | documentation-and-adrs | Ghi lại lý do, không chỉ ghi lại cái gì |
| Ship | observability-and-instrumentation | Log có cấu trúc, RED metrics, traces, alert theo triệu chứng |
| Ship | shipping-and-launch | Checklist trước khi lên production, monitor và rollback |
