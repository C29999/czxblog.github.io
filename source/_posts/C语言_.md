---
title: 竞赛|蓝桥杯备战
date: 2023-05-17 16:48:00
tags: 蓝桥杯
categories: 学习
description: 在备战蓝桥杯时候学习到的东西
top_img: https://cdn.jsdelivr.net/gh/C29999/P.bed/189d40b243a85776cea0a223ff40c90f.png
cover : https://cdn.jsdelivr.net/gh/C29999/P.bed/189d40b243a85776cea0a223ff40c90f.png
---
**蓝桥杯**考试知识点![蓝桥杯](https://cdn.jsdelivr.net/gh/C29999/P.bed/a8d22c0c1a12d34c9bdb7ceced5f0019.png)

## 算法模块

1.判断质数：

``` C++
bool isPrime(int n)
{
    if(n<=1) return false;
    for(int i=2;i*i<=n;i++)
{
    if(n%i==0) return false;
}
return true;
}

```

2.数字反转

``` C++

bool isReverse(int n)
{
    int s=0,k=n;
    while(n>0)
    {
        s=s*10;
        s=s+k%10;
        k=k/10；
    }
    if(s==n) return true;
    return false;
}
```

3.寻找最大公约数的递归算法

``` C++
int gcd(int a,int b)
{
    if(y)
 return gcd(b,a%b)
 else
 return a;
}
```

## 基础语法

### 常见函数

#### 取整函数

1.floor函数 向下取整 floor中文名为地板，即向下取整。
2.ceil函数 向上取整 ceil中文名为天花板，即向上取整。
3.round函数 四舍五入 round中文名为四舍五入。

#### memset函数

[memset函数](https://blog.csdn.net/Supreme7/article/details/115431235)
memset函数的原型：

void *memset(void*str, int c, size_t n)

### STL函数

### C++中的字符串函数

``` C++
void test()
{
        string str1;               //生成空字符串
    string str2("123456789");  //生成"1234456789"的复制品
    string str3("12345", 0, 3);//结果为"123"
    string str4("0123456", 5);  //结果为"01234"
    string str5(5, '1');       //结果为"11111"
    string str6(str2, 2);      //结果为"3456789"
}
```

字符串比较：
1 ++字符串支持常见的比较操作符（>,>=,<,<=,==,!=），**按字典序逐个比较**
2.Compare函数

``` C++
{
void test3()
{
    // (A的ASCII码是65，a的ASCII码是97)
    // 前面减去后面的ASCII码，>0返回1，<0返回-1，相同返回0
    string A("aBcd");
    string B("Abcd");
    string C("123456");
    string D("123dfg");
    // "aBcd" 和 "Abcd"比较------ a > A
    cout << "A.compare(B)：" << A.compare(B)<< endl;                          // 结果：1
    // "cd" 和 "Abcd"比较------- c > A
    cout << "A.compare(2, 3, B):" <<A.compare(2, 3, B)<< endl;                // 结果：1
    // "cd" 和 "cd"比较 
    cout << "A.compare(2, 3, B, 2, 3):" << A.compare(2, 3, B, 2, 3) << endl;  // 结果：0
    // 由结果看出来：0表示下标，3表示长度
    // "123" 和 "123"比较 
    cout << "C.compare(0, 3, D, 0, 3)" <<C.compare(0, 3, D, 0, 3) << endl;    // 结果：0
}

}
```

3.string的插入push——back(),insert()

``` C++
{
    void  test4()
{
    string s1;

    // 尾插一个字符
    s1.push_back('a');
    s1.push_back('b');
    s1.push_back('c');
    cout<<"s1:"<<s1<<endl; // s1:abc

    // insert(pos,char):在制定的位置pos前插入字符char
    s1.insert(s1.begin(),'1');
    cout<<"s1:"<<s1<<endl; // s1:1abc
}
}
```

Substr拷贝函数

``` C++

#include<iostream>
#include<string>
using namespace std;
int main()
{
    string s="sfsa";
    string a=s.substr(0,3);
    string b=s.substr();
    string c=s.substr(2,3);
    cout<<a<<endl;
    cout<<b<<endl;
    cout<<c<<endl;
    return 0;
}


```

 效果如图：
![alt text](https://cdn.jsdelivr.net/gh/C29999/P.bed/93c8e6145fb95dcc051eee175d19ddde.png)

#### 布尔类型的全排列函数

next_permutation(a.begin(), a.end())

#### Vetor数组（动态可变数组）

>学习数组视频 [Vector数组](https://www.bilibili.com/video/BV1914y1i77U/?spm_id_from=333.337.search-card.all.click&vd_source=c5401a748b9181518ac8973e4357cb19)

下面是学习笔记：

##### Vector数组的引用格式

队列栈有点类似

```  C++
#include<bits/stdc++.h>
{
    int main(void)
    {
        vector<int> a;
        //一般形式：vector<Type> namee 
    }
}
```

字符串的比较字符

##### vector数组的访问&修改

``` C++
#include<bits/stdc++.h>
int main(void)
{
    vector<int> a;
    a.push_back(1);
    a.push_back(2);
     a.push_back(3);//向a数组中插入三个值
     //如何获取数组长度，即用size函数
     printf("%d",a.size);
     //之后在用常规方法遍历数组：
     for(int i=0;i<a.szie();i++>)
     {
        printf("%d",a[i]);
     }
    return 0;
}
```

##### 如何在vector插入新的元素（四个函数）

``` C++
#include<bits/stdc++.h>
int main(void)
{
    vector<int> g;
    g.push_back(1);//向尾部插入1
    g.emplace_back(2);//向尾部插入2
    g.insert(g.begin(),3);//向开头插入3
    g.insert(g.begin(),3,3);//向开头插入3个3
    g.emplace(g.begin(),4);//向开头插入4//可变数组
    g.emplace(g.begin(),3,4);// 向开头插入3个4
    //前两者可以将新元素插入数组尾部，后两者可以将新元素插入任意位置
    return 0;
}
```

###### 如何在vector数组中删除元素

``` C++
#include<bits/stdc++.h>
int main(void)
{
    vectot<int> g;
    g.erase(g.beagin());//删除g数组开头的元素
    g.erase(g.end());//删除g数组结尾的元素
    //.erase（begin，end）删除[begin,ebd]区间内的所有元素
    g.erase(g.begin(),g.begin()+5);
    g.erase(g.begin,g.end);
    return 0;
}
```

###### vector数组中的其他元素

1.resize(len)函数可以手动改变Vector数组长度给数组扩容
2.clear可以清空vector中的所有数组
3.empty函数返回一个bool值，可以用来判断数组是否为空
4.vector可以实现反向遍历

``` C++
for(auto it=g.rbegin();it!=g.rand();++it)
{
    printf("%e",*it);
    return 0;
}
```

是利用结构题按字典序排序

### 字符串函数的应用（基于P534）

 ***题解***

``` C++
#include<stdio.h>
#include<string.h>
char temp[1000];
int main()
{
    char a[1110];
    char b[111];
    int n,m;
    int l,r;
    int k;
    scanf("%d",&n);
    scanf("%s",a);
    for(int i=0;i<n;i++)
    {
        scanf("%d",&m);
        if(m==1)
        {
            scanf("%s",b);
            strcat(a,b);
            printf("%s\n",a);
        }
        else if(m==2)
        {
            scanf("%d%d",&l,&r);
            a[l+r]='\0';
            strcpy(temp, &a[l]);
            strcpy(a, temp);
            printf("%s\n",a);
        }
         else if(m==3)
         {
             scanf("%d%s",&k,temp);
             strcat(temp,&a[k]);
             a[k]='\0';
             strcat(a, temp);
             printf("%s\n",a);
         }
         else if(m==4)//这部分也可用strstr()函数
         {
             int flag=0;
             char keep[1000]={0};
             scanf("%s",temp);
             for(int i=0;a[i]!='\0';i++)
             {
                 if(a[i]==temp[0])
                 {
                     for(int j=0;j<strlen(temp);j++)
                     {
                         keep[j]=a[i+j];
                     }
                     if(strcmp(keep,temp)==0)
                     {
                         printf("%d\n",i);
                         flag++；
                         break;
                     }
                 }   
             }
             if(!flag) printf("-1\n");
         }
    }
}
```

字符串函数的使用方法见CSDN:[字符串函数](https://blog.csdn.net/qq_56627079/article/details/118069504?ops_request_misc=%257B%2522request%255Fid%2522%253A%25226477EB58-2B0D-4320-A824-B037472A8662%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=6477EB58-2B0D-4320-A824-B037472A8662&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~top_positive~default-1-118069504-null-null.142^v100^pc_search_result_base8&utm_term=%E5%AD%97%E7%AC%A6%E4%B8%B2%E5%87%BD%E6%95%B0&spm=1018.2226.3001.4187)
洛谷P1597：
C语言解法：

``` C++
#include<bits/stdc++.h>
using namespace std;
int main(){
    int a=0,b=0,c=0;
    char s[256];
 cin>>s;
    int len=strlen(s);
    for(int i=0;i<len;i++){
        if(s[i]=='a'){
            if(s[i+3]=='a') a=a;
            - if(s[i+3]=='b') a=b;
            else if(s[i+3]=='c') a=c;
            else a=s[i+3]-'0';
        }

        if(s[i]=='b'){
            if(s[i+3]=='a') b=a;
            else if(s[i+3]=='b') b=b;
            else if(s[i+3]=='c') b=c;
            else b=s[i+3]-'0';
        }

            if(s[i]=='c'){
            if(s[i+3]=='a') c=a;
            else if(s[i+3]=='b') c=b;
            else if(s[i+3]=='c') c=c;
            else c=s[i+3]-'0';
        }
    }
    cout<<a<<" "<<b<<" "<<c;
    return 0;
}
```

***C语言解法：***

**比较两种题解我们可以看到C++的优势在于：**
***C++有更高效的赋值逻辑，可以直接利用数组索引进行赋值***

### 基本语法知识点

#### 布尔常量 bool

``` C++
bool vis[20];
if(!=vis[i])//表示从未访问过
```

### 链表

#### 链表和数组的区别

快速访问：很少插入，删除 使用数组
正常访问：经常插入，删除 链表

#### 比较杂的语法知识

##### 底层const和顶层const

**11.17未理解待补**见[const的应用](https://blog.csdn.net/weixin_43744293/article/details/117955427)

$\color{blue}{>洛谷P1312（重叠数boy，girl的个数）}$

``` C++
boy += (...)
```

$\color{blue} {boy是整类型（）中可以理解成bool常量如果是真则+1，如果是-则-1} $

## 算法

### 前缀和与差分

### 高精度算法

高精度加法：

``` C++
int aplusb(string a, string b, int *c)//
{
    int j1[505] = {0}, j2[505] = {0}, lena = a.length();//
    int lenb = b.length(), len = 0, jw = 0;//

    for(int i = 0; i < lena; i++) {//将字符串逆序存入数组j1和j2中，便于后续操作
        j1[i] = a[lena - i - 1] - '0';//  
    }
    for(int i = 0; i < lenb; i++) {
        j2[i] = b[lenb - i - 1] - '0';  
    }

    int i;
    for(i = 0; i < max(lena, lenb); i++) {//将两个数组对应位置相加，并处理进位
        c[i] = j1[i] + j2[i] + jw;
        jw = c[i] / 10;
        c[i] = c[i] % 10;
    }
    if(jw > 0) {//相加后有进位，则在数组末尾再加一位
        c[i] = jw;
        len = i + 1;
    } else {//否则数组长度即为最大值所在位置，即lena和lenb中较大的一个
        len = i;
    }

    return len;
}

```

### 排序算法

![alt text](https://cdn.jsdelivr.net/gh/C29999/P.bed/b69bb07464d1139131c949a1c92d8c0e.png)

#### 归并排序

[代码实现](https://blog.csdn.net/weixin_73470348/article/details/129734858?ops_request_misc=%257B%2522request%255Fid%2522%253A%25222ac56020201a5c61fcfb7aa8fbf39658%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=2ac56020201a5c61fcfb7aa8fbf39658&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~top_positive~default-1-129734858-null-null.142^v100^pc_search_result_base8&utm_term=%E5%BD%92%E5%B9%B6%E6%8E%92%E5%BA%8F%E7%AE%97%E6%B3%95&spm=1018.2226.3001.4187)
[动态视频](https://search.bilibili.com/all?vt=00260230&keyword=%E5%BD%92%E5%B9%B6%E6%8E%92%E5%BA%8F&from_source=webtop_search&spm_id_from=333.788&search_source=5)

#### 快速排序

[快速排序](https://blog.csdn.net/justidle/article/details/104203963?ops_request_misc=%257B%2522request%255Fid%2522%253A%252227f25d6189b61775a62ac18d2020520c%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=27f25d6189b61775a62ac18d2020520c&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~top_positive~default-1-104203963-null-null.142^v100^pc_search_result_base8&utm_term=%E5%BF%AB%E9%80%9F%E6%8E%92%E5%BA%8F&spm=1018.2226.3001.4187)
快速排序动态视频[快速排序](https://www.bilibili.com/video/BV1rW4y1x7Kh/?spm_id_from=333.337.search-card.all.click&vd_source=c5401a748b9181518ac8973e4357cb19)

##### 排序算法基于洛谷（P1177）

题解：

``` c++

//双指针法：
void QuickSort(int array[], int low, int high) {
    int i = low; 
    int j = high;
    if(i >= j) {
        return;
    }//退出递归的条件
 
    int temp = array[low];//P指针即pivot标准
    while(i != j) {
        while(array[j] >= temp && i < j) {
            j--;//指针从右向左移动找到一个直到比这个数小的数然后跟pivot进行交换
        }
    while(array[i] <= temp && i < j) {
            i++;//指针从左向右移动直到找个一个比pivot大的数
        }
    if(i < j) {
            swap(array[i], array[j]);//交换函数，二者进行交换
        }
    }
 
    //将基准temp放于自己的位置，（第i个位置）
    swap(array[low], array[i]);
    QuickSort(array, low, i - 1);//递归
    QuickSort(array, i + 1, high);
}

```

快速排序优化版本：

``` C++
void qs(int *a,int l,int r)
{
    int m=a[(l+r)/2],i=l,j=r;
    do{
        while(a[i]<m) i++;
        while(a[j]>m) j--;
        if(i<=j)
        {
            swap(a[i],a[j]);
            i++;
        j--;
        } 
    }while(i<=j);
    if(l<j) qs(a,l,j);
    if(r>i) qs(a,i,r);
}
```

P1177中的几种题解：
>冒泡排序过于简单最终只能拿六十分

#### 堆排序

堆排序笔记：![alt text](https://cdn.jsdelivr.net/gh/C29999/P.bed/32e1c7ccf7ee211734c5a94232f55ab5_720.jpg)
堆排序使用缺点：不稳定
**时间复杂度：O（nlogn）**
堆排序代码实现：

``` C++
//建堆：

void DownAdjust(int a[],int k,int n)
{
    int i=k,j=i*2;
    while(j<=n)//最多调整到叶结点
    {
        if(j+1<=n&&a[j+1]>a[j])j++;//j保持较大孩子的下标
        if(a[i]<a[k]){//a[i]<a[j]时换到下面
        swap(a[i],a[j]);
        i=j;
        j=i*2;
        }
        else{//a[i]>=a[j]则调整完毕 
        break;}
    }
}
void HeapSort(int a[],int n)
{
    //建堆（最后一个非叶结点开始依次向下调整）
    for(int i=n/2;i>=i;i--)
    {
        DownAdjust(a,j,n);
    }
    //每轮堆顶换到最后，向下调整新的堆顶
    for(int i=n;i>=2;i--)
    {
        swap(a[1],a[i]);
        DownAdjust(a,1,i-1);
    }
}

```

**自学视频网址：[堆排序](https://www.bilibili.com/video/BV1KrzrYeEQd?spm_id_from=333.788.videopod.sections&vd_source=c5401a748b9181518ac8973e4357cb19)

#### C++STLsort函数

**sort函数格式：sort（arr,arr+n,cmp）**首地址，未地址，和排序规则
第三个参数是排序条件,可以从大到小也可以从小到大
代码如下：

``` c++
int cmp(int a,int b)
{
    return a>b//降序排序
}

```

下面是利用结构题按字典序排序:
  
``` c++
struct student
{
    string name="0";
    int chinese=0;
    int math=0;
    int english=0;
    int sum = 0;
};
student stu[1005];
bool cmp(student& s1, student& s2)
{
    return s1.name < s2.name; 
}
  
int main()
{
    int n;
    cin >> n;
    for (int i = 0; i < n; ++i)
    {
        cin >> stu[i].name >> stu[i].chinese >> stu[i].math >> stu[i].english;
      stu[i].sum= stu[i].chinese + stu[i].math + stu[i].english;
    }
    sort(stu, stu+n,cmp); 
    return 0;
}

```

***sort函数用字符串排序，洛谷P1012***

``` C++
#include<bits/stdc++.h>
using namespace std;
string s[25];
bool cmp(string a,string b)
{
    return a+b>b+a;
}

int main(void)
{
    int n;//输入个数
    cin>>n;
    for(int i=1;i<=n;i++)cin>>s[i];
    sort(s+1,s+n+1,cmp);//排序规则，从大到小排列
    for(int i=1;i<=n;i++)cout<<s[i];
    return 0;
}
```

#### 用在结构体用sort代码，中引用Vector数组＋auto+const

基于P1104：

``` C++
#include <bits/stdc++.h>

using namespace std;

struct Person {
    string name;
    int year;
    int month;
    int day;
    int bian;
};

bool cmp(const Person& a, const Person& b) {
    if (a.year != b.year) {
        return a.year < b.year;
    } else if (a.month != b.month) {
        return a.month < b.month;
    } else if(a.day!=b.day) {
        return a.day < b.day;
    }
    else{
        return a.bian>b.bian;
    }
}

int main() {
    int n;
    cin >> n;
    vector<Person> people(n);
    for (int i = 0; i < n; i++) {
        cin >> people[i].name >> people[i].year >> people[i].month >> people[i].day;
        people[i].bian=i;
    }
    
    sort(people.begin(), people.end(), cmp);
    for (const auto& person : people) {
        cout << person.name << endl;
    }
    return 0;
}
```

### 二分算法/分治思想

### DFS深度优先搜索

``` C++

bool check(int x) {/* ... */} // 检查x是否满足某种性质

// 区间[l, r]被划分成[l, mid]和[mid + 1, r]时使用：
int bsearch_1(int l, int r)
{
    while (l < r)
    {
        int mid = l + r >> 1;
        if (check(mid)) r = mid;    // check()判断mid是否满足性质
        else l = mid + 1;
    }
    return l;
}
// 区间[l, r]被划分成[l, mid - 1]和[mid, r]时使用：
int bsearch_2(int l, int r)
{
    while (l < r)
    {
        int mid = l + r + 1 >> 1;
        if (check(mid)) l = mid;
        else r = mid - 1;
    }
    return l;
}

/*整数二分*/ 

 bool check(double x) {/* ... */} // 检查x是否满足某种性质

double bsearch_3(double l, double r)
{
    const double eps = 1e-6;   // eps 表示精度，取决于题目对精度的要求
    while (r - l > eps)
    {
        double mid = (l + r) / 2;
        if (check(mid)) r = mid;
        else l = mid;
    }
    return l;
}

/*浮点数二分*/ 
```

>这篇代码的语法知识点见上面的语法学习部分

***即结构在用sort进行排序时,字符串可以用字典序进行排序,排序的对应目标取决于排序条件中书写的参数**

DFS的模板：

``` C++
void dfs(int u)
{
    if(到达目的地)
    {
        //输出解
        //返回
    }
    //合理的剪枝操作(剪枝操作可以省略，但不是必须的)
    for(int i=1;i<=枚举数；i++)
    {
        if(满足条件)
        {
            更新状态位；
            dfs(step+1)
            恢复状态位；
        }
    }
}
// 例洛谷P1157 组合输出(组合输出)[https://www.luogu.com.cn/training/108#problems]
void dfs(int step,int flag)
{
 if(step==k)
 {
  for(int i=0;i<k;i++)
  {
   cout<<setw(3)<<arr[i];
  }
  cout<<endl;
  return ;
 } 
 if(n-flag<k-step) return ;
 for(int i=flag+1;i<=n;i++)//n的作用是限制枚举的范围，防止重复枚举
{
 arr[step]=i;
 dfs(step+1,i);
}  
}

```

**用递归去表示全排列算法**2

``` C++
void dfs(int step)
{
    if(step==n)
    {
        for(int i=0;i<n;i++)
        {
            cout<<a[i]<<" ";
        }
        cout<<endl;
        return ;
    }
    for(int i=step+1;i<=n;i++)
    {
        a[step]=i;
        check[i]=1;//标记为已经访问过，防止重复使用
        dfs(step+1);
        check[i]=0;//回溯的时候将他置为0，以便下一次使用
    }
}

由两个函数我们可以发现DFS的核心是找到枚举的最大数量，理解怎样进行回溯，怎样搜索

``` C++
#include<bits/stdc++.h>
using namespace std;
int a[20]={1,2,3,4,5,6,7,8,9,10,11,12,13};
bool vis[20];
int b[20];
void dfs(int s,int t)
{
    if(s==t)    //递归结束，产生一个全排列
    for(int i=0;i<t;++i)    cout<<b[i]<<" ";
    {
        cout<<endl;
        return ;
    }
}
for(int i=0;i<t;i++>)//主要部分
{
    if(!vis[i])//表示从未访问过
    {
        vis[i]=true;
        b[s]=a[i];
        dfs(s+1,t);
        vis[i]=false;
    }
}

```

DFS:
**第八届蓝桥杯C++A组，迷宫题**

### DP动态规划
