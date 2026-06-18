---
name: incremental-implementation
description: Triển khai thay đổi theo từng bước nhỏ. Dùng khi implement bất kỳ feature hoặc thay đổi nào chạm hơn một file. Dùng khi bạn sắp viết một lượng code lớn trong một lần, hoặc khi task có vẻ quá to để đổ vào một nhịp.
---

# Triển Khai Tăng Dần

## Tổng Quan

Hãy build theo các vertical slice mỏng: implement một phần nhỏ, test nó, verify nó, rồi mới mở rộng tiếp. Tránh làm cả feature trong một lượt. Mỗi increment phải để hệ thống ở trạng thái chạy được và kiểm thử được. Đây là kỷ luật thực thi giúp những feature lớn trở nên quản lý được.

## Khi Nào Dùng

- Implement thay đổi chạm nhiều file
- Build một feature mới từ task breakdown
- Refactor code hiện có
- Bất cứ khi nào bạn chuẩn bị viết hơn khoảng 100 dòng trước khi test

**Không dùng khi:** thay đổi chỉ ở một file, một function, và scope đã tối giản sẵn.

## Vòng Lặp Increment

```
Implement --> Test --> Verify --> Commit --> Next slice
```

Với mỗi slice:

1. **Implement** phần chức năng nhỏ nhất nhưng hoàn chỉnh
2. **Test** - chạy test tương ứng, hoặc viết test nếu chưa có
3. **Verify** - xác nhận slice hoạt động như mong đợi
4. **Commit** - lưu tiến độ bằng message mô tả rõ
5. **Next slice** - mang thành quả hiện tại sang bước tiếp theo, không làm lại từ đầu

## Các Cách Chia Slice

### Vertical Slice - Ưu tiên nhất

Build một đường đi hoàn chỉnh xuyên qua stack:

```
Slice 1: Tạo task (DB + API + UI cơ bản)
    -> Test pass, user tạo task được qua UI

Slice 2: List task (query + API + UI)
    -> Test pass, user nhìn thấy task của mình

Slice 3: Sửa task (update + API + UI)
    -> Test pass, user sửa task được

Slice 4: Xóa task (delete + API + UI + confirmation)
    -> Test pass, CRUD hoàn chỉnh
```

### Chia Theo Contract Trước

Khi backend và frontend cần làm song song:

```
Slice 0: Chốt API contract (types, interfaces, OpenAPI spec)
Slice 1a: Implement backend theo contract + API tests
Slice 1b: Implement frontend với mock data bám đúng contract
Slice 2: Tích hợp và test end-to-end
```

### Chia Theo Rủi Ro Trước

Làm phần rủi ro nhất hoặc mơ hồ nhất trước:

```
Slice 1: Chứng minh WebSocket kết nối được
Slice 2: Build cập nhật task realtime trên kết nối đó
Slice 3: Thêm offline support và reconnection
```

Nếu Slice 1 fail, bạn biết sớm trước khi đầu tư vào các slice còn lại.

## Quy Tắc Implement

### Rule 0: Đơn Giản Trước

Trước khi viết code, tự hỏi: "Cách đơn giản nhất mà vẫn chạy được là gì?"

Sau khi viết xong, soi lại:

- Có thể ít dòng hơn không?
- Các abstraction này có đáng không?
- Một staff engineer nhìn vào có hỏi "sao không làm đơn giản hơn?" không?
- Mình đang build cho task hiện tại hay cho một tương lai giả định?

```
SIMPLICITY CHECK:
X Generic EventBus có middleware pipeline cho một notification
V Gọi function trực tiếp

X Abstract factory pattern cho hai component khá giống nhau
V Hai component rõ ràng với utility dùng chung

X Form builder theo config cho ba form
V Ba form component riêng
```

Ba dòng code tương tự nhau vẫn tốt hơn một abstraction ra đời quá sớm. Hãy implement phiên bản ngây thơ nhưng hiển nhiên là đúng trước. Chỉ tối ưu khi correctness đã được chứng minh bằng test.

### Rule 0.5: Kỷ Luật Scope

Chỉ chạm vào thứ task yêu cầu.

Không được:

- cleanup code liền kề nhưng không liên quan
- refactor import ở file bạn không sửa
- xóa comment chưa hiểu rõ
- thêm tính năng không nằm trong spec vì "có vẻ hữu ích"
- modernize syntax ở file chỉ đang đọc

Nếu thấy chỗ khác đáng cải thiện, hãy note lại chứ đừng tiện tay sửa:

```
NOTICED BUT NOT TOUCHING:
- src/utils/format.ts có unused import
- auth middleware có thể cần error message tốt hơn
-> Có muốn mình tạo task riêng cho các việc này không?
```

### Rule 1: Mỗi Increment Chỉ Một Việc

Mỗi increment chỉ thay đổi một việc logic. Không trộn concern:

**Tệ:** một commit vừa thêm component mới, vừa refactor component cũ, vừa đổi build config.  
**Tốt:** ba commit riêng, mỗi commit một việc.

### Rule 2: Luôn Giữ Trạng Thái Build Được

Sau mỗi increment, project phải build được và test hiện có phải pass. Không để codebase ở trạng thái hỏng giữa các slice.

### Rule 3: Feature Flag Cho Feature Chưa Xong

Nếu feature chưa sẵn sàng cho user nhưng bạn cần merge từng phần:

```typescript
const ENABLE_TASK_SHARING = process.env.FEATURE_TASK_SHARING === 'true';

if (ENABLE_TASK_SHARING) {
  // UI chia sẻ task mới
}
```

Như vậy bạn vẫn merge increment nhỏ vào main mà không lộ feature dở dang.

### Rule 4: Safe Defaults

Code mới phải có default an toàn và bảo thủ:

```typescript
export function createTask(data: TaskInput, options?: { notify?: boolean }) {
  const shouldNotify = options?.notify ?? false;
  // ...
}
```

### Rule 5: Dễ Rollback

Mỗi increment nên revert được độc lập:

- thay đổi mang tính additive dễ revert hơn
- sửa code cũ phải nhỏ và tập trung
- migration nên có rollback strategy tương ứng
- tránh xóa cái cũ và thay cái mới trong cùng một commit

## Làm Việc Với Agent

Khi giao cho một agent implement theo từng phần:

```
"Hãy implement Task 3 từ plan.

Bắt đầu chỉ với schema change và API endpoint.
Chưa đụng UI, phần đó để increment sau.

Sau khi xong, chạy `npm test` và `npm run build`
để verify không có gì bị vỡ."
```

Hãy nói thật rõ cái gì nằm trong scope và cái gì chưa nằm trong scope của increment hiện tại.

## Checklist Mỗi Increment

Sau mỗi increment, verify:

- [ ] Thay đổi này chỉ làm một việc và làm trọn vẹn việc đó
- [ ] Tất cả test hiện có vẫn pass (`npm test`)
- [ ] Build thành công (`npm run build`)
- [ ] Type check pass (`npx tsc --noEmit`)
- [ ] Lint pass (`npm run lint`)
- [ ] Chức năng mới hoạt động như mong đợi
- [ ] Thay đổi đã được commit với message mô tả rõ

**Lưu ý:** Sau một lần chạy thành công, đừng chạy lại đúng cùng lệnh verify nếu code chưa thay đổi. Chỉ chạy lại sau khi có chỉnh sửa mới.

## Những Lý Do Tự Hợp Lý Hóa Thường Gặp

| Lý do | Sự thật |
|---|---|
| "Để cuối test một lần luôn" | Bug ở Slice 1 sẽ lan sang Slice 2-5. Hãy test từng slice. |
| "Làm một lèo sẽ nhanh hơn" | Chỉ nhanh cho tới khi có bug và bạn không biết 500 dòng thay đổi nào gây ra. |
| "Thay đổi nhỏ quá, không cần commit riêng" | Commit nhỏ là miễn phí. Commit lớn làm review và rollback đau đớn hơn. |
| "Feature flag để sau" | Nếu feature chưa xong thì không nên lộ cho user. |
| "Refactor này nhỏ, cho vào luôn" | Trộn refactor và feature làm cả hai khó review hơn. |
| "Để chạy build lại cho chắc" | Nếu code chưa đổi thì chạy lại không thêm thông tin gì. |

## Red Flags

- Viết hơn 100 dòng mà chưa test
- Một increment chứa nhiều thay đổi không liên quan
- "Tiện tay thêm cái này nữa"
- Bỏ qua test/verify để đi nhanh
- Build hoặc test bị vỡ giữa các increment
- Uncommitted changes cứ phình to
- Tạo abstraction trước khi có nhu cầu thật sự
- Chạm file ngoài scope "vì đang ở đây"
- Tạo utility file mới cho việc dùng đúng một lần
- Chạy lại cùng lệnh build/test hai lần liên tiếp khi code không đổi

## Verification

Sau khi hoàn thành toàn bộ các increment cho một task:

- [ ] Mỗi increment đã được test và commit riêng
- [ ] Toàn bộ test suite pass
- [ ] Build sạch
- [ ] Feature chạy end-to-end đúng như spec
- [ ] Không còn thay đổi chưa commit
