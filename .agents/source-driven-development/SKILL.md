---
name: source-driven-development
description: Neo mọi quyết định implement vào tài liệu chính thức. Dùng khi bạn muốn code có căn cứ từ nguồn chính thống, tránh pattern lỗi thời. Dùng khi build với framework hoặc library mà tính đúng đắn phụ thuộc mạnh vào version và best practice hiện tại.
---

# Phát Triển Dựa Trên Nguồn Chính Thức

## Tổng Quan

Mọi quyết định code phụ thuộc vào framework phải có chỗ dựa là tài liệu chính thức. Đừng implement bằng trí nhớ; hãy verify, cite và để người dùng thấy nguồn của bạn. Training data cũ đi, API bị deprecate, best practice thay đổi. Skill này giúp người dùng nhận được code đáng tin vì mọi pattern đều truy ngược được tới một nguồn có thẩm quyền.

## Khi Nào Dùng

- Người dùng muốn code theo best practice hiện tại của framework
- Build boilerplate, starter code hoặc pattern sẽ được copy đi nhiều nơi
- Người dùng nói rõ rằng họ muốn thứ "đúng", "đã verify", "có docs"
- Implement các phần mà pattern framework đặc biệt quan trọng như form, routing, data fetching, state, auth
- Review hoặc cải thiện code đang dùng pattern đặc thù framework
- Bất cứ khi nào bạn định viết framework-specific code bằng trí nhớ

**Không dùng khi:**

- Task không phụ thuộc version, như đổi tên biến, sửa typo, move file
- Logic thuần túy không phụ thuộc framework
- Người dùng nói rõ họ cần tốc độ hơn verification

## Quy Trình

```
DETECT --> FETCH --> IMPLEMENT --> CITE
```

### Bước 1: Nhận Diện Stack Và Version

Đọc file dependency để biết version chính xác:

```
package.json
composer.json
requirements.txt / pyproject.toml
go.mod
Cargo.toml
Gemfile
```

Nói rõ bạn đã tìm thấy gì:

```
STACK DETECTED:
- React 19.1.0 (từ package.json)
- Vite 6.2.0
- Tailwind CSS 4.0.3
-> Mình sẽ fetch tài liệu chính thức cho pattern liên quan.
```

Nếu version thiếu hoặc mơ hồ, **hãy hỏi người dùng**. Đừng đoán.

### Bước 2: Lấy Tài Liệu Chính Thức

Lấy đúng trang docs liên quan tới feature bạn sắp implement. Không lấy homepage, không cào cả site docs nếu chỉ cần một trang.

**Thứ tự ưu tiên nguồn:**

| Ưu tiên | Nguồn | Ví dụ |
|----------|--------|---------|
| 1 | Official documentation | react.dev, docs.djangoproject.com |
| 2 | Official blog / changelog | react.dev/blog, nextjs.org/blog |
| 3 | Web standards references | MDN, web.dev, WHATWG |
| 4 | Browser/runtime compatibility | caniuse.com, node.green |

**Không được dùng làm nguồn chính:**

- Stack Overflow
- Blog post hoặc tutorial bên thứ ba
- Tài liệu do AI sinh ra
- Ký ức từ training data

**Hãy fetch thật chính xác:**

```
Sai:  lấy homepage của React
Đúng: lấy react.dev/reference/react/useActionState

Sai:  search chung chung "django authentication best practices"
Đúng: mở docs.djangoproject.com/en/6.0/topics/auth/
```

Sau khi fetch, rút ra pattern chính và chú ý mọi ghi chú deprecate hoặc migration.

Nếu các nguồn chính thức mâu thuẫn nhau, hãy nêu sự mâu thuẫn đó cho user và xác minh pattern nào mới khớp với version đang dùng.

### Bước 3: Implement Đúng Theo Docs

Viết code bám sát thứ docs mô tả:

- dùng đúng signature trong docs, không dùng trí nhớ
- nếu docs chỉ cách mới, dùng cách mới
- nếu docs deprecate một pattern, đừng dùng pattern cũ
- nếu docs không nói tới, hãy đánh dấu là chưa verify

**Khi docs mâu thuẫn với code hiện có trong repo:**

```
CONFLICT DETECTED:
Code hiện tại dùng useState để giữ trạng thái loading của form,
nhưng React 19 docs khuyên dùng useActionState cho pattern này.

Options:
A) Dùng pattern mới theo docs
B) Bám codebase hiện tại để giữ tính nhất quán
-> Bạn muốn chọn hướng nào?
```

Đừng âm thầm chọn một phía.

### Bước 4: Dẫn Nguồn

Mỗi framework-specific pattern phải có citation. Người dùng phải kiểm chứng được từng quyết định.

**Trong comment code:**

```typescript
// React 19 form handling with useActionState
// Source: https://react.dev/reference/react/useActionState#usage
const [state, formAction, isPending] = useActionState(submitOrder, initialState);
```

**Trong hội thoại:**

```
Mình dùng useActionState thay vì useState tự quản lý pending state
vì React 19 khuyến nghị hook này cho form actions.

Source: https://react.dev/blog/2024/12/05/react-19#actions
```

**Quy tắc citation:**

- dùng full URL
- ưu tiên deep link có anchor khi có thể
- trích dẫn ngắn đoạn liên quan nếu quyết định không hiển nhiên
- nếu khuyên dùng feature nền tảng, kèm thêm data về browser/runtime support khi cần
- nếu không tìm thấy docs, phải nói thẳng:

```
UNVERIFIED: Mình chưa tìm được tài liệu chính thức cho pattern này.
Phần này dựa trên kiến thức cũ và có thể lỗi thời.
```

Trung thực về thứ mình chưa verify có giá trị hơn sự tự tin giả.

## Những Lý Do Tự Hợp Lý Hóa Thường Gặp

| Lý do | Sự thật |
|---|---|
| "Mình nhớ API này mà" | Tự tin không phải bằng chứng. Training data đầy pattern lỗi thời. |
| "Lấy docs tốn token" | Hallucinate một API còn tốn hơn, vì người dùng mất hàng giờ debug. |
| "Docs chắc không có thứ mình cần" | Nếu docs không có, đó là tín hiệu quan trọng rằng pattern đó có thể không chính thức. |
| "Mình sẽ chỉ nói là có thể lỗi thời" | Disclaimer mơ hồ không giúp gì. Hoặc verify và cite, hoặc nói rõ là chưa verify. |
| "Task đơn giản, khỏi cần check" | Những task đơn giản hay bị copy thành template khắp codebase. |

## Red Flags

- Viết framework-specific code mà không check docs cho đúng version
- Dùng cụm "mình nghĩ", "có lẽ" về API thay vì dẫn nguồn
- Implement pattern mà không biết nó áp dụng cho version nào
- Dẫn nguồn Stack Overflow hoặc blog thay vì docs chính thức
- Dùng API đã deprecated vì nó xuất hiện trong training data
- Không đọc `package.json` hay dependency file trước khi code
- Giao code mà không có citation cho quyết định không hiển nhiên
- Lấy cả site docs trong khi chỉ cần một trang

## Verification

Sau khi làm theo source-driven development, xác nhận:

- [ ] Đã xác định framework/library version từ dependency file
- [ ] Đã fetch docs chính thức cho pattern liên quan
- [ ] Nguồn dùng là official docs, không phải blog hay training data
- [ ] Code đi theo đúng pattern của docs version hiện tại
- [ ] Các quyết định không hiển nhiên có citation full URL
- [ ] Không dùng API deprecated
- [ ] Mọi conflict giữa docs và code hiện tại đã được nêu ra
- [ ] Mọi thứ chưa verify được đã bị đánh dấu rõ ràng
