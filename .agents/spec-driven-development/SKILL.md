---
name: spec-driven-development
description: Tạo spec trước khi code. Dùng khi bắt đầu dự án mới, feature mới, hoặc thay đổi đáng kể mà chưa có specification. Dùng khi requirements còn mơ hồ, chưa đầy đủ, hoặc chỉ mới tồn tại dưới dạng ý tưởng chung chung.
---

# Phát Triển Theo Spec

## Tổng Quan

Hãy viết một specification có cấu trúc trước khi viết code. Spec là nguồn sự thật chung giữa bạn và kỹ sư con người: nó định nghĩa chúng ta đang build cái gì, vì sao, và làm sao biết là đã xong. Code mà không có spec là đang đoán.

## Khi Nào Dùng

- Bắt đầu một dự án hoặc feature mới
- Requirements còn mơ hồ hoặc chưa đầy đủ
- Thay đổi chạm nhiều file hoặc nhiều module
- Bạn sắp đưa ra quyết định kiến trúc
- Task có thể mất hơn 30 phút để implement

**Không dùng khi:** sửa một dòng, sửa typo, hoặc những thay đổi có yêu cầu rõ ràng và tự đầy đủ.

## Workflow Có Cổng Kiểm Soát

Spec-driven development có bốn pha. Không được sang pha tiếp theo cho tới khi pha hiện tại đã được kiểm tra.

```
SPECIFY --> PLAN --> TASKS --> IMPLEMENT
   |         |        |          |
   v         v        v          v
 Human    Human    Human      Human
 review   review   review     review
```

### Pha 1: Specify

Bắt đầu bằng tầm nhìn cấp cao. Hỏi người dùng cho tới khi requirements đủ cụ thể.

**Phải nêu assumptions ngay từ đầu.** Trước khi viết bất kỳ nội dung spec nào, liệt kê những gì bạn đang ngầm giả định:

```
ASSUMPTIONS I'M MAKING:
1. Đây là ứng dụng web chứ không phải mobile native
2. Authentication dùng session cookie chứ không phải JWT
3. Database là PostgreSQL dựa trên Prisma schema hiện có
4. Chỉ nhắm tới trình duyệt hiện đại, không hỗ trợ IE11
-> Nếu assumption nào sai thì chỉnh giúp mình ngay, còn không mình sẽ tiếp tục dựa trên chúng.
```

Không được âm thầm lấp chỗ trống trong requirement. Toàn bộ giá trị của spec là kéo hiểu nhầm ra trước khi có code, và assumptions là dạng hiểu nhầm nguy hiểm nhất.

**Viết một spec bao phủ sáu phần cốt lõi sau:**

1. **Objective** - Chúng ta đang build gì và vì sao? Ai là người dùng? Thành công là gì?

2. **Commands** - Ghi đầy đủ command chạy được, có cả flags, không chỉ ghi tên tool.
   ```
   Build: npm run build
   Test: npm test -- --coverage
   Lint: npm run lint --fix
   Dev: npm run dev
   ```

3. **Project Structure** - Source code nằm ở đâu, test ở đâu, docs ở đâu.
   ```
   src/           -> source code ứng dụng
   src/components -> React components
   src/lib        -> shared utilities
   tests/         -> unit và integration tests
   e2e/           -> end-to-end tests
   docs/          -> tài liệu
   ```

4. **Code Style** - Một đoạn code mẫu thật sẽ hữu ích hơn nhiều đoạn mô tả suông. Bao gồm naming conventions, format rules, và ví dụ thế nào là code tốt.

5. **Testing Strategy** - Dùng framework nào, test để ở đâu, kỳ vọng coverage thế nào, tầng test nào dùng cho loại concern nào.

6. **Boundaries** - Hệ ba tầng:
   - **Always do:** luôn chạy test trước commit, theo naming conventions, validate input
   - **Ask first:** đổi database schema, thêm dependency, đổi CI config
   - **Never do:** commit secrets, sửa vendor directories, xóa failing tests khi chưa được duyệt

**Mẫu spec:**

```markdown
# Spec: [Tên dự án / feature]

## Objective
[Mình đang build gì và vì sao. User story hoặc acceptance criteria.]

## Tech Stack
[Framework, ngôn ngữ, dependency chính kèm version]

## Commands
[Build, test, lint, dev - ghi full command]

## Project Structure
[Cấu trúc thư mục kèm mô tả]

## Code Style
[Đoạn code ví dụ + các convention chính]

## Testing Strategy
[Framework, vị trí test, kỳ vọng coverage, các tầng test]

## Boundaries
- Always: [...]
- Ask first: [...]
- Never: [...]

## Success Criteria
[Làm sao biết việc này đã xong - điều kiện cụ thể, kiểm chứng được]

## Open Questions
[Những điểm chưa chốt cần người dùng trả lời]
```

**Hãy chuyển instruction mơ hồ thành success criteria cụ thể.** Ví dụ:

```
REQUIREMENT: "Làm dashboard nhanh hơn"

REFRAMED SUCCESS CRITERIA:
- Dashboard LCP < 2.5s trên mạng 4G
- Tải dữ liệu ban đầu hoàn tất trong < 500ms
- Không có layout shift lúc load (CLS < 0.1)
-> Các target này có đúng không?
```

Cách này giúp bạn lặp, retry và giải quyết vấn đề hướng mục tiêu rõ ràng thay vì đoán "nhanh hơn" nghĩa là gì.

### Pha 2: Plan

Khi spec đã được duyệt, sinh ra implementation plan kỹ thuật:

1. Xác định các thành phần chính và dependency giữa chúng
2. Xác định thứ tự implement, cái gì phải làm trước
3. Ghi lại rủi ro và cách giảm thiểu
4. Xác định phần nào có thể làm song song và phần nào bắt buộc tuần tự
5. Đặt các checkpoint verification giữa các phase

Plan phải đủ để người dùng đọc vào và nói "đúng, cách này hợp lý" hoặc "không, đổi chỗ này".

### Pha 3: Tasks

Chia plan thành các task rời, có thể implement:

- Mỗi task phải xong được trong một phiên tập trung
- Mỗi task có acceptance criteria rõ ràng
- Mỗi task có bước verify cụ thể như test, build, manual check
- Task được sắp theo dependency, không theo cảm giác quan trọng
- Không task nào nên cần sửa quá khoảng 5 file

**Mẫu task:**
```markdown
- [ ] Task: [Mô tả]
  - Acceptance: [Điều gì phải đúng khi xong]
  - Verify: [Cách xác nhận - command test, build, manual check]
  - Files: [Những file sẽ chạm tới]
```

### Pha 4: Implement

Thực thi từng task một theo `incremental-implementation` và `test-driven-development`. Dùng `context-engineering` để chỉ nạp đúng phần spec và source file cần thiết ở từng bước thay vì nhồi toàn bộ spec vào context.

## Giữ Spec Luôn Sống

Spec là tài liệu sống, không phải artifact chỉ viết một lần:

- **Cập nhật khi quyết định đổi** - nếu phát hiện data model phải thay đổi, cập nhật spec trước rồi mới implement
- **Cập nhật khi scope đổi** - thêm hoặc cắt feature phải phản ánh vào spec
- **Commit spec** - spec phải nằm trong version control cùng với code
- **Dẫn spec trong PR** - link về đúng phần spec mà PR đó đang implement

## Những Cách Tự Hợp Lý Hóa Thường Gặp

| Lý do | Sự thật |
|---|---|
| "Việc này đơn giản, không cần spec" | Task đơn giản không cần spec dài, nhưng vẫn cần acceptance criteria. Spec hai dòng vẫn là spec. |
| "Code xong rồi mình viết spec sau" | Đó là tài liệu hóa, không còn là specification nữa. |
| "Viết spec sẽ làm chậm" | 15 phút viết spec rẻ hơn hàng giờ sửa lại do build sai. |
| "Requirement kiểu gì cũng thay đổi" | Vì thế spec là tài liệu sống. Spec cũ vẫn tốt hơn là không có spec. |
| "User biết họ muốn gì mà" | Kể cả request rõ ràng cũng chứa assumption ngầm. Spec lôi chúng ra ngoài. |

## Red Flags

- Bắt đầu code mà không có requirement nào được viết ra
- Hỏi "hay mình cứ build luôn nhé?" trước khi biết "done" nghĩa là gì
- Implement tính năng không hề xuất hiện trong spec hoặc task list
- Đưa ra quyết định kiến trúc mà không ghi lại
- Bỏ qua spec vì nghĩ "quá rõ rồi còn gì"

## Verification

Trước khi sang implementation, xác nhận:

- [ ] Spec đã bao phủ đủ sáu phần cốt lõi
- [ ] Người dùng đã review và duyệt spec
- [ ] Success criteria cụ thể và có thể kiểm chứng
- [ ] Boundaries kiểu Always / Ask First / Never đã được định nghĩa
- [ ] Spec đã được lưu thành file trong repository
