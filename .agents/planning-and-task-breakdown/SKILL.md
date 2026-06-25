---
name: planning-and-task-breakdown
description: Chia công việc thành các task có thứ tự. Dùng khi đã có spec hoặc requirement khá rõ và cần chuyển chúng thành các task có thể implement. Dùng khi task quá lớn để bắt đầu ngay, khi cần ước lượng scope, hoặc khi có thể làm song song.
---

# Lập Kế Hoạch Và Chia Nhỏ Task

## Tổng Quan

Hãy phân rã công việc thành các task nhỏ, có thể kiểm chứng, với acceptance criteria rõ ràng. Chia task tốt là khác biệt giữa một agent hoàn thành công việc đáng tin cậy và một agent tạo ra mớ hỗn độn khó gỡ. Mỗi task phải đủ nhỏ để implement, test và verify trong một phiên tập trung.

## Khi Nào Dùng

- Đã có spec và cần chuyển thành các đơn vị có thể implement
- Task quá lớn hoặc quá mơ hồ để bắt đầu ngay
- Công việc cần chia cho nhiều agent hoặc nhiều phiên
- Cần trình bày scope rõ ràng cho người dùng
- Chưa rõ thứ tự implement

**Không dùng khi:** thay đổi chỉ ở một file, scope quá hiển nhiên, hoặc spec đã có sẵn các task đủ rõ.

## Quy Trình Lập Kế Hoạch

### Bước 1: Vào Plan Mode

Trước khi viết code, làm ở chế độ chỉ đọc:

- đọc spec và các phần codebase liên quan
- nhận diện pattern và convention hiện có
- vẽ dependency giữa các thành phần
- ghi lại rủi ro và điểm chưa rõ

**Không được viết code trong giai đoạn plan.** Output ở đây là tài liệu kế hoạch, không phải implementation.

### Bước 2: Xác Định Dependency Graph

Xem cái gì phụ thuộc vào cái gì:

```
Database schema
    |
    |-- API models/types
    |       |
    |       |-- API endpoints
    |       |       |
    |       |       '-- Frontend API client
    |       |               |
    |       |               '-- UI components
    |       |
    |       '-- Validation logic
    |
    '-- Seed data / migrations
```

Thứ tự implement đi từ dưới lên theo dependency graph: dựng nền trước.

### Bước 3: Chia Theo Lát Dọc

Thay vì làm xong toàn bộ database, rồi toàn bộ API, rồi toàn bộ UI, hãy build từng đường đi hoàn chỉnh xuyên qua stack:

**Tệ, vì chia ngang:**
```
Task 1: Làm toàn bộ database schema
Task 2: Làm toàn bộ API endpoints
Task 3: Làm toàn bộ UI components
Task 4: Nối tất cả lại
```

**Tốt, vì chia dọc:**
```
Task 1: User tạo được tài khoản (schema + API + UI cho đăng ký)
Task 2: User đăng nhập được (auth schema + API + UI cho login)
Task 3: User tạo được task (task schema + API + UI cho tạo mới)
Task 4: User xem được danh sách task (query + API + UI cho list view)
```

Mỗi vertical slice đều đem lại một phần chức năng chạy được và kiểm thử được.

### Bước 4: Viết Task

Mỗi task nên có cấu trúc sau:

```markdown
## Task [N]: [Tiêu đề ngắn, mô tả rõ]

**Description:** Một đoạn ngắn giải thích task này đạt được điều gì.

**Acceptance criteria:**
- [ ] [Điều kiện cụ thể, kiểm chứng được]
- [ ] [Điều kiện cụ thể, kiểm chứng được]

**Verification:**
- [ ] Test pass: `npm test -- --grep "feature-name"`
- [ ] Build thành công: `npm run build`
- [ ] Manual check: [mô tả thứ cần xác minh]

**Dependencies:** [Số task mà task này phụ thuộc, hoặc "None"]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [Small: 1-2 files | Medium: 3-5 files | Large: 5+ files]
```

### Bước 5: Sắp Thứ Tự Và Đặt Checkpoint

Sắp task sao cho:

1. Dependencies được thỏa mãn
2. Mỗi task đều để lại hệ thống ở trạng thái chạy được
3. Cứ mỗi 2-3 task có một checkpoint verification
4. Task rủi ro cao đi sớm để fail fast

Thêm các checkpoint rõ ràng:

```markdown
## Checkpoint: Sau Task 1-3
- [ ] Tất cả test pass
- [ ] Ứng dụng build không lỗi
- [ ] Core user flow chạy end-to-end
- [ ] Review với người dùng trước khi đi tiếp
```

## Hướng Dẫn Kích Cỡ Task

| Kích cỡ | Số file | Scope | Ví dụ |
|---|---|---|---|
| **XS** | 1 | Một function hoặc config nhỏ | Thêm một rule validation |
| **S** | 1-2 | Một component hoặc endpoint | Thêm một API endpoint |
| **M** | 3-5 | Một feature slice | Luồng đăng ký người dùng |
| **L** | 5-8 | Feature nhiều thành phần | Search có filter và pagination |
| **XL** | 8+ | **Quá lớn, phải tách tiếp** | - |

Nếu task là L hoặc lớn hơn, gần như chắc chắn phải tách tiếp. Agent làm tốt nhất với task cỡ S và M.

**Dấu hiệu cần tách nhỏ hơn nữa:**

- Sẽ mất hơn một phiên tập trung, khoảng 2 giờ agent work trở lên
- Không thể mô tả acceptance criteria trong 3 bullet trở xuống
- Chạm từ hai subsystem độc lập trở lên
- Tiêu đề task có chữ "và", thường là dấu hiệu nó đang chứa hai task

## Mẫu Tài Liệu Kế Hoạch

```markdown
# Implementation Plan: [Tên feature / project]

## Overview
[Tóm tắt một đoạn về thứ mình đang build]

## Architecture Decisions
- [Quyết định chính 1 và lý do]
- [Quyết định chính 2 và lý do]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, build sạch

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Checkpoint: Core Features
- [ ] End-to-end flow hoạt động

### Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...

### Checkpoint: Complete
- [ ] Tất cả acceptance criteria đã đạt
- [ ] Sẵn sàng để review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [High/Med/Low] | [Cách xử lý] |

## Open Questions
- [Điểm cần người dùng trả lời]
```

## Cơ Hội Làm Song Song

Khi có nhiều agent hoặc nhiều phiên làm việc:

- **Có thể song song an toàn:** các feature slice độc lập, test cho phần đã xong, documentation
- **Bắt buộc tuần tự:** database migrations, thay đổi shared state, các chuỗi dependency
- **Cần phối hợp:** các feature dùng chung một API contract, phải chốt contract trước rồi mới tách nhánh làm song song

## Những Lý Do Tự Hợp Lý Hóa Thường Gặp

| Lý do | Sự thật |
|---|---|
| "Cứ làm rồi sẽ nghĩ tiếp" | Đó là con đường ngắn nhất dẫn tới mớ hỗn độn và rework. |
| "Task quá rõ, không cần viết ra" | Cứ viết. Viết ra mới lòi dependency ẩn và edge case bị quên. |
| "Planning chỉ là overhead" | Planning chính là công việc. Không có plan thì implementation chỉ là gõ code mù. |
| "Tôi giữ hết trong đầu được" | Context window hữu hạn. Kế hoạch viết ra mới sống sót qua session boundary và compaction. |

## Red Flags

- Bắt đầu implement khi chưa có task list viết ra
- Task kiểu "implement the feature" nhưng không có acceptance criteria
- Không có bước verification trong plan
- Toàn bộ task đều ở cỡ XL
- Không có checkpoint giữa các phase
- Không xét dependency order

## Verification

Trước khi bắt đầu implement, xác nhận:

- [ ] Mọi task đều có acceptance criteria
- [ ] Mọi task đều có bước verification
- [ ] Dependency của task đã được nhận diện và sắp đúng thứ tự
- [ ] Không task nào chạm quá khoảng 5 file
- [ ] Có checkpoint giữa các phase chính
- [ ] Người dùng đã review và đồng ý với plan
